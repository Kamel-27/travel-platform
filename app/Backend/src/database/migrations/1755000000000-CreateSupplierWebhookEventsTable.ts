import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupplierWebhookEventsTable1755000000000 implements MigrationInterface {
  name = 'CreateSupplierWebhookEventsTable1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "supplier_webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "supplier" "supplier_provider" NOT NULL DEFAULT 'duffel',
        "supplier_event_id" character varying NOT NULL,
        "supplier_resource_id" character varying,
        "event_type" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "booking_id" uuid,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        CONSTRAINT "ux_supplier_webhook_events_supplier_event" UNIQUE ("supplier", "supplier_event_id"),
        CONSTRAINT "fk_supplier_webhook_events_booking" FOREIGN KEY ("booking_id")
          REFERENCES "bookings"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_supplier_webhook_events_resource"
        ON "supplier_webhook_events" ("supplier_resource_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_supplier_webhook_events_unprocessed"
        ON "supplier_webhook_events" ("processed_at")
        WHERE "processed_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "schedule_change_detected_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN "schedule_change_detected_at"
    `);
    await queryRunner.query(
      `DROP INDEX "ix_supplier_webhook_events_unprocessed"`,
    );
    await queryRunner.query(`DROP INDEX "ix_supplier_webhook_events_resource"`);
    await queryRunner.query(`DROP TABLE "supplier_webhook_events"`);
  }
}
