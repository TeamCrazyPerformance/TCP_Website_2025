import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudyIsPublic1771500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Study" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Study" DROP COLUMN "is_public"`,
    );
  }
}
