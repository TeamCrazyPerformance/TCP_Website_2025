import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStudyCycle1771300000000 implements MigrationInterface {
    name = 'AddStudyCycle1771300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Study" ADD "cycle" varchar(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Study" DROP COLUMN "cycle"`);
    }
}
