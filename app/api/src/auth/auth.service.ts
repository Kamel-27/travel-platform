import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterCompanyDto } from './dto';
import { UserRole } from '../../generated/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Register a new company with its admin user + wallet
   */
  async register(dto: RegisterCompanyDto) {
    // Check for existing email / license
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const existingCompany = await this.prisma.company.findUnique({
      where: { licenseNumber: dto.licenseNumber },
    });
    if (existingCompany) {
      throw new ConflictException(
        'A company with this license number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, this.SALT_ROUNDS);

    // Create company + admin user + wallet in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          nameAr: dto.companyNameAr,
          licenseNumber: dto.licenseNumber,
          country: dto.country,
          city: dto.city,
          address: dto.address,
          phone: dto.companyPhone,
          email: dto.companyEmail,
          website: dto.website,
          contactPersonName: dto.adminFullName,
          contactPersonPhone: dto.adminPhone,
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.adminEmail,
          passwordHash,
          fullName: dto.adminFullName,
          fullNameAr: dto.adminFullNameAr,
          phone: dto.adminPhone,
          role: UserRole.COMPANY_ADMIN,
        },
      });

      // Create wallet for the company
      await tx.wallet.create({
        data: {
          companyId: company.id,
          currency: 'SAR',
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'REGISTER',
          entity: 'Company',
          entityId: company.id,
          changes: {
            companyName: company.name,
            adminEmail: user.email,
          },
        },
      });

      return { company, user };
    });

    this.logger.log(
      `New company registered: ${result.company.name} (${result.company.id})`,
    );

    return {
      message:
        'Registration successful. Your account is pending admin approval.',
      company: {
        id: result.company.id,
        name: result.company.name,
        status: result.company.status,
      },
    };
  }

  /**
   * Authenticate user with email + password
   */
  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { company: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Check if company is active (skip for SUPER_ADMIN)
    if (user.company && user.company.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        `Your company account is ${user.company.status.toLowerCase()}. Please contact support.`,
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    // Store hashed refresh token
    const refreshHash = crypto
      .createHash('sha256')
      .update(tokens.refreshToken)
      .digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: refreshHash,
        lastLoginAt: new Date(),
      },
    });

    return tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    let payload: JwtPayload;

    try {
      payload = jwt.verify(refreshToken, refreshSecret!) as unknown as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    // Verify refresh token matches stored hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    if (tokenHash !== user.refreshTokenHash) {
      // Token reuse detected — revoke all tokens
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException(
        'Token reuse detected. Please login again.',
      );
    }

    // Rotate refresh token
    const newTokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    const newRefreshHash = crypto
      .createHash('sha256')
      .update(newTokens.refreshToken)
      .digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshHash },
    });

    return newTokens;
  }

  /**
   * Logout — invalidate refresh token
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private generateTokens(payload: JwtPayload): AuthTokens {
    const jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
    const jwtRefreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const jwtExpiry = this.config.get<string>('JWT_EXPIRY') || '15m';
    const jwtRefreshExpiry =
      this.config.get<string>('JWT_REFRESH_EXPIRY') || '7d';

    const tokenPayload = { ...payload };

    const accessToken = jwt.sign(
      tokenPayload,
      jwtSecret,
      { expiresIn: jwtExpiry } as jwt.SignOptions,
    );

    const refreshToken = jwt.sign(
      tokenPayload,
      jwtRefreshSecret,
      { expiresIn: jwtRefreshExpiry } as jwt.SignOptions,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
