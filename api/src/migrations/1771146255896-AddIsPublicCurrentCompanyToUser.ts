import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsPublicCurrentCompanyToUser1771146255896 implements MigrationInterface {
    name = 'AddIsPublicCurrentCompanyToUser1771146255896'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "is_public_current_company" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_public_current_company"`);
    }
}
