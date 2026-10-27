import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refund execution becomes three-phase: claim the row (`executing`, with
 * gateway_attempted_at), call Paymob outside any transaction, record the
 * result. A retry that finds the row in `executing` must NOT call the
 * gateway again — the previous call may have gone through and only the
 * recording failed — so a refund can no longer be issued twice.
 *
 * Postgres cannot drop an enum value, so `down` only removes the column.
 */
export class RefundExecutingStatus1761000000000 implements MigrationInterface {
  name = 'RefundExecutingStatus1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "refund_status" ADD VALUE IF NOT EXISTS 'executing'
    `);
    await queryRunner.query(`
      ALTER TABLE "refunds"
        ADD COLUMN "gateway_attempted_at" TIMESTAMP WITH TIME ZONE NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "refunds" SET "status" = 'pending' WHERE "status" = 'executing'
    `);
    await queryRunner.query(`
      ALTER TABLE "refunds" DROP COLUMN "gateway_attempted_at"
    `);
  }
}
