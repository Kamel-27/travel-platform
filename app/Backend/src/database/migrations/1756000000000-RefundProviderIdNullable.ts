import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refunds are now created as `pending` rows BEFORE the gateway call (the
 * provider refund id only exists after Paymob accepts the refund), so
 * provider_refund_id must be nullable. The unique constraint stays —
 * Postgres permits multiple NULLs under a UNIQUE constraint.
 */
export class RefundProviderIdNullable1756000000000 implements MigrationInterface {
  name = 'RefundProviderIdNullable1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refunds" ALTER COLUMN "provider_refund_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Pending/failed rows have no provider id yet; give them a sentinel so
    // the revert can restore NOT NULL without violating it.
    await queryRunner.query(`
      UPDATE "refunds" SET "provider_refund_id" = 'unassigned:' || "id"
      WHERE "provider_refund_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "refunds" ALTER COLUMN "provider_refund_id" SET NOT NULL
    `);
  }
}
