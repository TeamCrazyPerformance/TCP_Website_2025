import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncreaseStudyTagLength1771400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Study" ALTER COLUMN "tag" TYPE varchar(300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Study" ALTER COLUMN "tag" TYPE varchar(100)`,
    );
  }
}
