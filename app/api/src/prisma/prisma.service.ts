import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.seed();
  }

  private async seed() {
    try {
      const userCount = await this.user.count();
      if (userCount === 0) {
        console.log('🌱 Database is empty. Seeding initial developer demo accounts...');
        
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash('password123', 12);
        
        await this.$transaction(async (tx) => {
          // 1. Create company
          const company = await tx.company.create({
            data: {
              name: 'TravelHub Agency',
              licenseNumber: 'LIC-77777',
              country: 'SA',
              city: 'Riyadh',
              phone: '+966 50 123 4567',
              email: 'agency@travelhub.com',
              status: 'ACTIVE', // Must be ACTIVE so login succeeds!
              markupPercentage: 5.00,
            },
          });
          
          // 2. Create user
          await tx.user.create({
            data: {
              companyId: company.id,
              email: 'agent@travelhub.com',
              fullName: 'Developer Agent',
              passwordHash,
              role: 'COMPANY_ADMIN',
              isActive: true,
            },
          });
          
          // 3. Create wallet with ample balance
          await tx.wallet.create({
            data: {
              companyId: company.id,
              balance: 100000.00, // 100K SAR!
              currency: 'SAR',
            },
          });
          
          console.log('✅ Seeding complete! Log in with:');
          console.log('   Email:    agent@travelhub.com');
          console.log('   Password: password123');
        });
      }
    } catch (error) {
      console.error('❌ Failed to seed database:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
