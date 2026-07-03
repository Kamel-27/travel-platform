import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the refresh_tokens table for JWT refresh-token rotation (auth_flow.md §4).
// Kept out of the ERD's commercial model by design — session storage is an implementation detail.
export class AddRefreshTokens1751700000000 implements MigrationInterface {
  name = 'AddRefreshTokens1751700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying NOT NULL,
        "family_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "user_agent" character varying,
        "ip" character varying,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_refresh_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Family index for efficient reuse-detection revocation (revoke all in family)
    await queryRunner.query(`
      CREATE INDEX "ix_refresh_tokens_family_id"
        ON "refresh_tokens" ("family_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
