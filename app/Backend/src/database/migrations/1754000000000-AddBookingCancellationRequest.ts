import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingCancellationRequest1754000000000 implements MigrationInterface {
  name = 'AddBookingCancellationRequest1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "cancellation_requested_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "cancellation_request_reason" character varying
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_bookings_cancellation_requested" ON "bookings" ("cancellation_requested_at")
      WHERE "cancellation_requested_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_bookings_cancellation_requested"`);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN "cancellation_requested_at",
        DROP COLUMN "cancellation_request_reason"
    `);
  }
}
