import { MigrationInterface, QueryRunner } from 'typeorm';

export class CascadeStudyDeletion1789300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Progress" DROP CONSTRAINT "FK_b809a880585e3c0f6d2795e5cd8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Progress" ADD CONSTRAINT "FK_b809a880585e3c0f6d2795e5cd8" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "Resource" DROP CONSTRAINT "FK_7ab14c453c85f7792dd4c3940ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Resource" ADD CONSTRAINT "FK_7ab14c453c85f7792dd4c3940ce" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "StudyMember" DROP CONSTRAINT "FK_2e48b3d9928394043c381ed33e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "StudyMember" ADD CONSTRAINT "FK_2e48b3d9928394043c381ed33e3" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "StudyMember" DROP CONSTRAINT "FK_2e48b3d9928394043c381ed33e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "StudyMember" ADD CONSTRAINT "FK_2e48b3d9928394043c381ed33e3" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "Resource" DROP CONSTRAINT "FK_7ab14c453c85f7792dd4c3940ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Resource" ADD CONSTRAINT "FK_7ab14c453c85f7792dd4c3940ce" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "Progress" DROP CONSTRAINT "FK_b809a880585e3c0f6d2795e5cd8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Progress" ADD CONSTRAINT "FK_b809a880585e3c0f6d2795e5cd8" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
