import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeRegistrationFieldsOptional1769511626650 implements MigrationInterface {
    name = 'MakeRegistrationFieldsOptional1769511626650'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // student_number를 nullable로 변경
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "student_number" DROP NOT NULL`);

        // major를 nullable로 변경
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "major" DROP NOT NULL`);

        // join_year를 nullable로 변경
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "join_year" DROP NOT NULL`);

        // birth_date를 nullable로 변경
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "birth_date" DROP NOT NULL`);

        // gender를 nullable로 변경하고 기본값 제거
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "gender" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "gender" DROP DEFAULT`);

        // education_status를 nullable로 변경하고 기본값 제거
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "education_status" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "education_status" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백 시 기본값 설정 및 NOT NULL 복원
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "education_status" SET DEFAULT '재학'`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "education_status" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "gender" SET DEFAULT 'Male'`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "gender" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "birth_date" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "join_year" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "major" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "student_number" SET NOT NULL`);
    }
}
