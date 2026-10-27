import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refunds need the Paymob *transaction* id, but attempts only stored the
 * Paymob *order* id, so RefundExecutionService read the transaction id back
 * from the stored `transaction.succeeded` webhook row — which the retention
 * cron deletes after 90 days. Any booking paid more than 90 days before its
 * cancellation could therefore never be refunded.
 *
 * The id is now persisted on the attempt at the moment of success. Existing
 * rows are backfilled from the webhook events that still exist.
 *
 * Also flips the `payments.provider` default from the Stripe placeholder to
 * `paymob`, the only provider the code has ever written.
 */
export class PaymentAttemptProviderTransactionId1759000000000 implements MigrationInterface {
  name = 'PaymentAttemptProviderTransactionId1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_attempts"
        ADD COLUMN "provider_transaction_id" character varying NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_payment_attempts_provider_txn"
        ON "payment_attempts" ("provider_transaction_id")
    `);
    await queryRunner.query(`
      UPDATE "payment_attempts" a
      SET "provider_transaction_id" = e."payload"->'obj'->>'id'
      FROM "payment_webhook_events" e
      WHERE e."payment_attempt_id" = a."id"
        AND e."event_type" = 'transaction.succeeded'
        AND e."payload"->'obj'->>'id' IS NOT NULL
        AND a."provider_transaction_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'paymob'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'stripe'
    `);
    await queryRunner.query(`
      DROP INDEX "ix_payment_attempts_provider_txn"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_attempts" DROP COLUMN "provider_transaction_id"
    `);
  }
}
