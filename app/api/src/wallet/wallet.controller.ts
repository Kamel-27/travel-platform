import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../../generated/prisma';

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async getBalance(@CurrentUser('companyId') companyId: string) {
    return this.walletService.getBalance(companyId);
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: string,
  ) {
    return this.walletService.getTransactions(companyId, page, limit, type);
  }

  @Post('deposit/approve')
  @Roles(UserRole.SUPER_ADMIN)
  async approveDeposit(
    @CurrentUser('sub') adminId: string,
    @Body()
    body: {
      companyId: string;
      amount: number;
      reference: string;
      idempotencyKey: string;
    },
  ) {
    return this.walletService.processDeposit(
      body.companyId,
      body.amount,
      body.reference,
      body.idempotencyKey,
      adminId,
    );
  }
}
