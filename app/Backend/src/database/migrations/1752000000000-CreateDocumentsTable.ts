import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentsTable1752000000000 implements MigrationInterface {
  name = 'CreateDocumentsTable1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "booking_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "unique_identifier" character varying NOT NULL,
        "supplier_passenger_ids" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_documents" PRIMARY KEY ("id"),
        CONSTRAINT "fk_documents_booking" FOREIGN KEY ("booking_id")
          REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_documents_booking_id" ON "documents" ("booking_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_documents_booking_id"`);
    await queryRunner.query(`DROP TABLE "documents"`);
  }
}
