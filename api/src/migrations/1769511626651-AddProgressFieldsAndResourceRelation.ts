import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProgressFieldsAndResourceRelation1769511626651 implements MigrationInterface {
    name = 'AddProgressFieldsAndResourceRelation1769511626651'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add week_no and progress_date to Progress table
        await queryRunner.query(`ALTER TABLE "Progress" ADD "week_no" integer`);
        await queryRunner.query(`ALTER TABLE "Progress" ADD "progress_date" TIMESTAMP`);

        // Add progress_id to Resource table
        await queryRunner.query(`ALTER TABLE "Resource" ADD "progress_id" integer`);

        // Add Foreign Key constraint linking Resource to Progress
        await queryRunner.query(`ALTER TABLE "Resource" ADD CONSTRAINT "FK_resource_progress_custom" FOREIGN KEY ("progress_id") REFERENCES "Progress"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Resource" DROP CONSTRAINT "FK_resource_progress_custom"`);
        await queryRunner.query(`ALTER TABLE "Resource" DROP COLUMN "progress_id"`);
        await queryRunner.query(`ALTER TABLE "Progress" DROP COLUMN "progress_date"`);
        await queryRunner.query(`ALTER TABLE "Progress" DROP COLUMN "week_no"`);
    }
}
