import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveStudentNumberUnique1771200000000 implements MigrationInterface {
    name = 'RemoveStudentNumberUnique1771200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // student_number UNIQUE 제약 조건 제거 (학번 중복 허용)
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_305f99f34a214909d328147986c"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // student_number UNIQUE 제약 조건 복원
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_305f99f34a214909d328147986c" UNIQUE ("student_number")`);
    }
}
