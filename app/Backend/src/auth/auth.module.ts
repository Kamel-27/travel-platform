import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthIdentity } from './entities/auth-identity.entity';
import { MagicLinkToken } from './entities/magic-link-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { AccountResolutionService } from './services/account-resolution.service';
import { MagicLinkService } from './services/magic-link.service';
import { MailService } from './services/mail.service';
import { TokenService } from './services/token.service';
import { GoogleAuthService } from './services/google-auth.service';
import { MagicLinkTokenPurgeService } from './services/magic-link-token-purge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuthIdentity,
      MagicLinkToken,
      RefreshToken,
    ]),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('ACCESS_TOKEN_TTL_SECONDS', 900),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [
    TokenService,
    AccountResolutionService,
    MagicLinkService,
    MailService,
    GoogleAuthService,
    MagicLinkTokenPurgeService,
  ],
  exports: [
    TokenService,
    AccountResolutionService,
    JwtModule,
    GoogleAuthService,
  ],
})
export class AuthModule {}
