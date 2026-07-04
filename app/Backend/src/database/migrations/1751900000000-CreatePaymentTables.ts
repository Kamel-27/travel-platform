import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTables1751900000000 implements MigrationInterface {
  name = 'CreatePaymentTables1751900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create custom payment enums
    await queryRunner.query(
      `CREATE TYPE "payment_provider" AS ENUM ('stripe')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_attempt_status" AS ENUM ('requires_action', 'processing', 'succeeded', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "refund_status" AS ENUM ('pending', 'succeeded', 'failed')`,
    );

    // 2. Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "provider" "payment_provider" NOT NULL DEFAULT 'stripe',
        "status" "payment_status" NOT NULL DEFAULT 'pending',
        "amount" integer NOT NULL,
        "currency" character(3) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_payments_booking_id" UNIQUE ("booking_id"),
        CONSTRAINT "fk_payments_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT
      )
    `);

    // 3. Create payment_attempts table
    await queryRunner.query(`
      CREATE TABLE "payment_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL,
        "provider_reference_id" character varying NOT NULL,
        "status" "payment_attempt_status" NOT NULL,
        "failure_reason" character varying,
        "method" character varying,
        "attempted_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_payment_attempts_provider_ref" UNIQUE ("provider_reference_id"),
        CONSTRAINT "fk_payment_attempts_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_payment_attempts_provider_ref"
        ON "payment_attempts" ("provider_reference_id")
    `);

    // 4. Create payment_webhook_events table
    await queryRunner.query(`
      CREATE TABLE "payment_webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" "payment_provider" NOT NULL,
        "provider_event_id" character varying NOT NULL,
        "event_type" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "payment_id" uuid,
        "payment_attempt_id" uuid,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        CONSTRAINT "ux_payment_webhook_events_provider_event" UNIQUE ("provider", "provider_event_id"),
        CONSTRAINT "fk_payment_webhook_events_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_payment_webhook_events_payment_attempt" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_payment_webhook_events_unprocessed"
        ON "payment_webhook_events" ("processed_at")
        WHERE "processed_at" IS NULL
    `);

    // 5. Create refunds table
    await queryRunner.query(`
      CREATE TABLE "refunds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_id" uuid NOT NULL,
        "provider_refund_id" character varying NOT NULL,
        "amount" integer NOT NULL,
        "currency" character(3) NOT NULL,
        "supplier_refund_amount" integer,
        "status" "refund_status" NOT NULL DEFAULT 'pending',
        "reason" character varying,
        "initiated_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_refunds_provider_refund_id" UNIQUE ("provider_refund_id"),
        CONSTRAINT "fk_refunds_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_refunds_user" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refunds"`);
    await queryRunner.query(`DROP TABLE "payment_webhook_events"`);
    await queryRunner.query(`DROP TABLE "payment_attempts"`);
    await queryRunner.query(`DROP TABLE "payments"`);

    await queryRunner.query(`DROP TYPE "refund_status"`);
    await queryRunner.query(`DROP TYPE "payment_attempt_status"`);
    await queryRunner.query(`DROP TYPE "payment_status"`);
    await queryRunner.query(`DROP TYPE "payment_provider"`);
  }
}
