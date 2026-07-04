import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1753000000000 implements MigrationInterface {
  name = 'CreateAuditLogsTable1753000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid NOT NULL,
        "action" character varying NOT NULL,
        "entity_type" character varying NOT NULL,
        "entity_id" character varying NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_audit_logs_user" FOREIGN KEY ("actor_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_audit_logs_actor_created" ON "audit_logs" ("actor_user_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_audit_logs_actor_created"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
