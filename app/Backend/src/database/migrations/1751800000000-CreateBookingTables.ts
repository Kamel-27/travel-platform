import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingTables1751800000000 implements MigrationInterface {
  name = 'CreateBookingTables1751800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create Enums
    await queryRunner.query(
      `CREATE TYPE "markup_type" AS ENUM ('percentage', 'fixed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "booking_status" AS ENUM ('pending', 'awaiting_payment', 'paid', 'confirmed', 'order_failed', 'cancelled', 'failed', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "supplier_provider" AS ENUM ('duffel')`,
    );
    await queryRunner.query(
      `CREATE TYPE "passenger_type" AS ENUM ('adult', 'child', 'infant')`,
    );
    await queryRunner.query(
      `CREATE TYPE "passenger_title" AS ENUM ('mr', 'ms', 'mrs', 'miss')`,
    );
    await queryRunner.query(
      `CREATE TYPE "passenger_gender" AS ENUM ('m', 'f')`,
    );

    // 2. Create markup_rules
    await queryRunner.query(`
      CREATE TABLE "markup_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" "markup_type" NOT NULL,
        "value" numeric(10,3) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "created_by_user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_markup_rules_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_markup_rules_active_one"
        ON "markup_rules" ("is_active")
        WHERE "is_active" = true
    `);

    // 3. Create bookings
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "markup_rule_id" uuid,
        "status" "booking_status" NOT NULL DEFAULT 'pending',
        "supplier" "supplier_provider" NOT NULL DEFAULT 'duffel',
        "supplier_idempotency_key" character varying NOT NULL,
        "supplier_order_id" character varying,
        "booking_reference" character varying,
        "base_amount" integer NOT NULL,
        "markup_amount" integer NOT NULL,
        "total_amount" integer NOT NULL,
        "currency" character(3) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_bookings_supplier_idempotency_key" UNIQUE ("supplier_idempotency_key"),
        CONSTRAINT "ux_bookings_supplier_order_id" UNIQUE ("supplier_order_id"),
        CONSTRAINT "fk_bookings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_bookings_markup_rule" FOREIGN KEY ("markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE SET NULL,
        CONSTRAINT "ck_bookings_total_match" CHECK ("total_amount" = "base_amount" + "markup_amount")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_bookings_user_created"
        ON "bookings" ("user_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_bookings_booking_reference"
        ON "bookings" ("booking_reference")
    `);

    // 4. Create flight_offer_snapshots
    await queryRunner.query(`
      CREATE TABLE "flight_offer_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "supplier" "supplier_provider" NOT NULL,
        "supplier_offer_id" character varying NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "owner_airline_name" character varying NOT NULL,
        "owner_airline_iata" character varying NOT NULL,
        "total_amount" integer NOT NULL,
        "tax_amount" integer NOT NULL,
        "currency" character(3) NOT NULL,
        "cabin_class" character varying NOT NULL,
        "conditions" jsonb NOT NULL,
        "passenger_identity_documents_required" boolean NOT NULL DEFAULT false,
        "raw_offer" jsonb NOT NULL,
        "captured_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_flight_offer_snapshots_booking" FOREIGN KEY ("booking_id")
          REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "ux_flight_offer_snapshots_booking_id" UNIQUE ("booking_id")
      )
    `);

    // 5. Create slices
    await queryRunner.query(`
      CREATE TABLE "slices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "offer_snapshot_id" uuid NOT NULL,
        "origin" character varying(3) NOT NULL,
        "destination" character varying(3) NOT NULL,
        "duration" character varying NOT NULL,
        "fare_brand_name" character varying,
        CONSTRAINT "fk_slices_offer_snapshot" FOREIGN KEY ("offer_snapshot_id")
          REFERENCES "flight_offer_snapshots"("id") ON DELETE CASCADE
      )
    `);

    // 6. Create segments
    await queryRunner.query(`
      CREATE TABLE "segments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slice_id" uuid NOT NULL,
        "marketing_carrier" character varying(2) NOT NULL,
        "operating_carrier" character varying(2) NOT NULL,
        "flight_number" character varying NOT NULL,
        "aircraft" character varying,
        "departing_at_local" timestamp NOT NULL,
        "origin_timezone" character varying NOT NULL,
        "arriving_at_local" timestamp NOT NULL,
        "destination_timezone" character varying NOT NULL,
        "origin_terminal" character varying,
        "destination_terminal" character varying,
        CONSTRAINT "fk_segments_slice" FOREIGN KEY ("slice_id")
          REFERENCES "slices"("id") ON DELETE CASCADE
      )
    `);

    // 7. Create passengers
    await queryRunner.query(`
      CREATE TABLE "passengers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "supplier_passenger_id" character varying,
        "type" "passenger_type" NOT NULL,
        "title" "passenger_title" NOT NULL,
        "gender" "passenger_gender" NOT NULL,
        "given_name" character varying NOT NULL,
        "family_name" character varying NOT NULL,
        "date_of_birth" date NOT NULL,
        "phone_number" character varying NOT NULL,
        "email" character varying NOT NULL,
        "responsible_adult_passenger_id" uuid,
        "document_type" character varying,
        "document_number" character varying,
        "document_expiry" date,
        "nationality" character varying,
        CONSTRAINT "fk_passengers_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_passengers_responsible_adult" FOREIGN KEY ("responsible_adult_passenger_id") REFERENCES "passengers"("id") ON DELETE SET NULL,
        CONSTRAINT "ck_passengers_infant_adult" CHECK ("type" != 'infant' OR "responsible_adult_passenger_id" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_passengers_booking_supplier_pax"
        ON "passengers" ("booking_id", "supplier_passenger_id")
        WHERE "supplier_passenger_id" IS NOT NULL
    `);

    // 8. Create booking_status_history
    await queryRunner.query(`
      CREATE TABLE "booking_status_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "from_status" "booking_status" NOT NULL,
        "to_status" "booking_status" NOT NULL,
        "changed_by_user_id" uuid,
        "reason" character varying,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_booking_status_history_booking" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_booking_status_history_user" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "booking_status_history"`);
    await queryRunner.query(`DROP TABLE "passengers"`);
    await queryRunner.query(`DROP TABLE "segments"`);
    await queryRunner.query(`DROP TABLE "slices"`);
    await queryRunner.query(`DROP TABLE "flight_offer_snapshots"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "markup_rules"`);

    await queryRunner.query(`DROP TYPE "passenger_gender"`);
    await queryRunner.query(`DROP TYPE "passenger_title"`);
    await queryRunner.query(`DROP TYPE "passenger_type"`);
    await queryRunner.query(`DROP TYPE "supplier_provider"`);
    await queryRunner.query(`DROP TYPE "booking_status"`);
    await queryRunner.query(`DROP TYPE "markup_type"`);
  }
}
