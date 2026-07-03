import { MigrationInterface, QueryRunner } from 'typeorm';

// User / AuthIdentity / MagicLinkToken per docs/erd.md — the M1 auth foundation.
export class InitAuthTables1751600000000 implements MigrationInterface {
  name = 'InitAuthTables1751600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('technical_admin', 'user')`,
    );
    await queryRunner.query(
      `CREATE TYPE "auth_provider" AS ENUM ('google', 'email_link')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "email_verified_at" timestamptz,
        "full_name" character varying,
        "phone" character varying,
        "role" "user_role" NOT NULL DEFAULT 'user',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_identities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" "auth_provider" NOT NULL,
        "provider_user_id" character varying,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_auth_identities_user_provider" UNIQUE ("user_id", "provider"),
        CONSTRAINT "fk_auth_identities_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    // One Google sub can never map to two users (account-takeover guard);
    // partial so multiple email_link rows (provider_user_id NULL) coexist
    await queryRunner.query(`
      CREATE UNIQUE INDEX "ux_auth_identities_provider_user"
        ON "auth_identities" ("provider", "provider_user_id")
        WHERE "provider_user_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "magic_link_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "email" character varying NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "requested_ip" character varying,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_magic_link_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    // Verification hot path — lookup is by hash, never by raw token
    await queryRunner.query(`
      CREATE INDEX "ix_magic_link_tokens_token_hash"
        ON "magic_link_tokens" ("token_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "magic_link_tokens"`);
    await queryRunner.query(`DROP TABLE "auth_identities"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "auth_provider"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
