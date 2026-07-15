import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLedgerTable1757000000000 implements MigrationInterface {
  name = 'CreateLedgerTable1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the custom ledger entry type enum
    await queryRunner.query(
      `CREATE TYPE "ledger_entry_type" AS ENUM ('customer_payment', 'gateway_refund', 'supplier_charge', 'supplier_refund', 'adjustment')`,
    );

    // 2. Create the ledger_entries table
    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "entry_type" "ledger_entry_type" NOT NULL,
        "amount" integer NOT NULL,
        "currency" character(3) NOT NULL,
        "supplier" "supplier_provider",
        "payment_id" uuid,
        "booking_id" uuid,
        "refund_id" uuid,
        "note" character varying,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_ledger_entries_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_ledger_entries_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_ledger_entries_refund" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL
      )
    `);

    // 3. Create indexes
    await queryRunner.query(`
      CREATE INDEX "ix_ledger_entries_created_at" ON "ledger_entries" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_ledger_entries_booking" ON "ledger_entries" ("booking_id")
    `);

    // 4. Backfill from existing rows
    // 4a. Backfill succeeded / partially_refunded / refunded payments -> customer_payment
    await queryRunner.query(`
      INSERT INTO "ledger_entries" ("entry_type", "amount", "currency", "payment_id", "booking_id", "created_at", "note")
      SELECT
        'customer_payment'::"ledger_entry_type",
        "amount",
        "currency",
        "id" AS "payment_id",
        "booking_id",
        "created_at",
        'Backfill: Customer payment'
      FROM "payments"
      WHERE "status" IN ('succeeded', 'refunded', 'partially_refunded')
    `);

    // 4b. Backfill succeeded refunds -> gateway_refund
    await queryRunner.query(`
      INSERT INTO "ledger_entries" ("entry_type", "amount", "currency", "payment_id", "booking_id", "refund_id", "created_at", "note")
      SELECT
        'gateway_refund'::"ledger_entry_type",
        -r."amount",
        r."currency",
        r."payment_id",
        p."booking_id",
        r."id" AS "refund_id",
        r."created_at",
        'Backfill: Gateway refund'
      FROM "refunds" r
      JOIN "payments" p ON r."payment_id" = p."id"
      WHERE r."status" = 'succeeded'
    `);

    // 4c. Backfill orders confirmed supplier-side -> supplier_charge
    await queryRunner.query(`
      INSERT INTO "ledger_entries" ("entry_type", "amount", "currency", "supplier", "booking_id", "created_at", "note")
      SELECT
        'supplier_charge'::"ledger_entry_type",
        -b."base_amount",
        b."currency",
        b."supplier",
        b."id" AS "booking_id",
        b."created_at",
        'Backfill: Supplier charge'
      FROM "bookings" b
      WHERE b."supplier_order_id" IS NOT NULL
    `);

    // 4d. Backfill supplier cancellations -> supplier_refund
    await queryRunner.query(`
      INSERT INTO "ledger_entries" ("entry_type", "amount", "currency", "supplier", "booking_id", "refund_id", "created_at", "note")
      SELECT
        'supplier_refund'::"ledger_entry_type",
        r."supplier_refund_amount",
        r."currency",
        'duffel'::"supplier_provider" AS "supplier",
        p."booking_id",
        r."id" AS "refund_id",
        r."created_at",
        'Backfill: Supplier refund'
      FROM "refunds" r
      JOIN "payments" p ON r."payment_id" = p."id"
      WHERE r."supplier_refund_amount" IS NOT NULL AND r."supplier_refund_amount" > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_ledger_entries_booking"`);
    await queryRunner.query(`DROP INDEX "ix_ledger_entries_created_at"`);
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TYPE "ledger_entry_type"`);
  }
}
