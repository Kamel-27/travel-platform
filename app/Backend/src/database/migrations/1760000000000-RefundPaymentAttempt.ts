import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A refund can now be pinned to one PaymentAttempt. That is how a capture
 * that should never have happened — a second successful attempt on a
 * booking that is already paid or confirmed — is refunded without touching
 * the booking's own payment: the pinned refund targets that attempt's
 * transaction, does not count against the booking-level refundable balance,
 * and does not roll the booking to `refunded`.
 */
export class RefundPaymentAttempt1760000000000 implements MigrationInterface {
  name = 'RefundPaymentAttempt1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refunds"
        ADD COLUMN "payment_attempt_id" uuid NULL,
        ADD CONSTRAINT "fk_refunds_payment_attempt"
          FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_refunds_payment_attempt_id"
        ON "refunds" ("payment_attempt_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_refunds_payment_attempt_id"`);
    await queryRunner.query(`
      ALTER TABLE "refunds"
        DROP CONSTRAINT "fk_refunds_payment_attempt",
        DROP COLUMN "payment_attempt_id"
    `);
  }
}
