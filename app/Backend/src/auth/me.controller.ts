import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorCode } from '../common/dto/error-response.dto';
import { User } from '../users/user.entity';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './guards/jwt-auth.guard';

// GET /api/v1/me per api_contract.md §1 — top-level, not under /auth
@Controller('me')
export class MeController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() jwtUser: unknown): Promise<{
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    role: string;
  }> {
    const payload = jwtUser as JwtPayload;
    const user = await this.userRepo.findOneBy({ id: payload.sub });
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHENTICATED,
        message: 'User not found',
      });
    }
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }
}
