import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTicketsTable1758000000000
  implements MigrationInterface
{
  name = 'CreateSupportTicketsTable1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "support_ticket_type" AS ENUM (
        'cancellation', 'flight_delay', 'name_change', 'refund', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "support_ticket_status" AS ENUM (
        'open', 'in_progress', 'resolved'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "support_ticket_type" NOT NULL,
        "booking_reference" character varying,
        "description" text NOT NULL,
        "status" "support_ticket_status" NOT NULL DEFAULT 'open',
        "admin_note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_support_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "fk_support_tickets_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_support_tickets_user_created"
        ON "support_tickets" ("user_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_support_tickets_status_created"
        ON "support_tickets" ("status", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_support_tickets_status_created"`);
    await queryRunner.query(`DROP INDEX "ix_support_tickets_user_created"`);
    await queryRunner.query(`DROP TABLE "support_tickets"`);
    await queryRunner.query(`DROP TYPE "support_ticket_status"`);
    await queryRunner.query(`DROP TYPE "support_ticket_type"`);
  }
}
