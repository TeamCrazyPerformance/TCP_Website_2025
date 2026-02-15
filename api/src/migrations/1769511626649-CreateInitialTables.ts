import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialTables1769511626649 implements MigrationInterface {
    name = 'CreateInitialTables1769511626649'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // === ENUM types ===
        await queryRunner.query(`CREATE TYPE "public"."user_gender_enum" AS ENUM('Male', 'Female')`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('GUEST', 'MEMBER', 'ADMIN')`);
        await queryRunner.query(`CREATE TYPE "public"."user_education_status_enum" AS ENUM('재학', '휴학', '졸업')`);
        await queryRunner.query(`CREATE TYPE "public"."team_execution_type_enum" AS ENUM('online', 'offline', 'hybrid')`);
        await queryRunner.query(`CREATE TYPE "public"."team_status_enum" AS ENUM('open', 'closed')`);
        await queryRunner.query(`CREATE TYPE "public"."resume_review_status_enum" AS ENUM('pending', 'reviewed', 'accepted', 'rejected')`);

        // === Tables ===

        // user: student_number, major, join_year, birth_date는 nullable, gender/education_status는 nullable + 기본값 없음 (2nd migration 반영)
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(50) NOT NULL, "password" character varying(255) NOT NULL, "name" character varying(50) NOT NULL, "student_number" character varying(20), "profile_image" character varying(255) NOT NULL DEFAULT 'default_profile_image.png', "phone_number" character varying(20) NOT NULL, "email" character varying(255) NOT NULL, "major" character varying(100), "join_year" smallint, "birth_date" date, "gender" "public"."user_gender_enum", "role" "public"."user_role_enum" NOT NULL DEFAULT 'GUEST', "tech_stack" text array, "education_status" "public"."user_education_status_enum", "current_company" character varying(255), "baekjoon_username" character varying(255), "github_username" character varying(255), "self_description" text, "portfolio_link" character varying(255), "is_public_github_username" boolean NOT NULL DEFAULT false, "is_public_email" boolean NOT NULL DEFAULT false, "is_public_tech_stack" boolean NOT NULL DEFAULT false, "is_public_education_status" boolean NOT NULL DEFAULT false, "is_public_portfolio_link" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username"), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "announcement" ("id" SERIAL NOT NULL, "title" text NOT NULL, "contents" text NOT NULL, "summary" text NOT NULL, "views" integer NOT NULL DEFAULT '0', "publishAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, CONSTRAINT "PK_e0ef0550174fd1099a308fd18a0" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "Study" ("id" SERIAL NOT NULL, "study_name" character varying(100) NOT NULL, "start_year" smallint NOT NULL, "study_description" text, "tag" character varying(100), "recruit_count" integer, "period" character varying(100), "apply_deadline" TIMESTAMP NOT NULL DEFAULT now(), "place" character varying(100), "way" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c08afd78f5c7848b66835bd0d17" PRIMARY KEY ("id"))`);

        // Progress: week_no, progress_date 포함 (3rd migration 반영)
        await queryRunner.query(`CREATE TABLE "Progress" ("id" SERIAL NOT NULL, "title" text NOT NULL, "content" text, "week_no" integer, "progress_date" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "study_id" integer, CONSTRAINT "PK_050af20d7d2e640b410da789e1d" PRIMARY KEY ("id"))`);

        // Resource: progress_id 포함 (3rd migration 반영)
        await queryRunner.query(`CREATE TABLE "Resource" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "format" character varying(10) NOT NULL, "dir_path" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "study_id" integer, "progress_id" integer, CONSTRAINT "PK_c029bb9649165945fc2fa675de0" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "StudyMember" ("id" SERIAL NOT NULL, "role" character varying(10) NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, "study_id" integer, CONSTRAINT "PK_3d40a38564d942da320e5c2156f" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "refresh_token" ("id" SERIAL NOT NULL, "token_hash" character varying(500) NOT NULL, "device_info" character varying(255), "expires_at" TIMESTAMP NOT NULL, "last_used_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "team" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "category" character varying(100) NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "deadline" date NOT NULL, "description" text NOT NULL, "tech_stack" character varying(255), "tag" character varying(100), "goals" text, "execution_type" "public"."team_execution_type_enum" NOT NULL DEFAULT 'online', "selection_proc" character varying(255), "link" character varying(255), "contact" character varying(255) NOT NULL, "status" "public"."team_status_enum" NOT NULL DEFAULT 'open', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "project_image" character varying(255), "leader_id" uuid, CONSTRAINT "PK_f57d8293406df4af348402e4b74" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "team_role" ("id" SERIAL NOT NULL, "role_name" character varying(100) NOT NULL, "recruit_count" integer NOT NULL, "current_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "team_id" integer, CONSTRAINT "PK_b4d9c800f392007b4e5a19f90ef" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "team_member" ("id" SERIAL NOT NULL, "is_leader" boolean NOT NULL DEFAULT false, "user_id" uuid, "team_id" integer, "team_role_id" integer, CONSTRAINT "UQ_34169355c6d1744228f5bb75549" UNIQUE ("user_id", "team_id"), CONSTRAINT "PK_649680684d72a20d279641469c5" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "resume" ("id" SERIAL NOT NULL, "name" character varying(200) NOT NULL, "student_number" character varying(8) NOT NULL, "major" character varying(100) NOT NULL, "phone_number" character varying(20) NOT NULL, "tech_stack" text, "area_interest" text NOT NULL, "self_introduction" text NOT NULL, "club_expectation" text NOT NULL, "submit_year" smallint NOT NULL, "review_status" "public"."resume_review_status_enum" NOT NULL DEFAULT 'pending', "review_comment" text, "reviewed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7ff05ea7599e13fac01ac812e48" PRIMARY KEY ("id")); COMMENT ON COLUMN "resume"."id" IS 'PK'; COMMENT ON COLUMN "resume"."name" IS '이름'; COMMENT ON COLUMN "resume"."student_number" IS '학번'; COMMENT ON COLUMN "resume"."major" IS '전공(학과)'; COMMENT ON COLUMN "resume"."phone_number" IS '전화번호'; COMMENT ON COLUMN "resume"."tech_stack" IS '기술 스택'; COMMENT ON COLUMN "resume"."area_interest" IS '관심분야'; COMMENT ON COLUMN "resume"."self_introduction" IS '자기소개'; COMMENT ON COLUMN "resume"."club_expectation" IS '동아리에 원하는 점(학습 목표)'; COMMENT ON COLUMN "resume"."submit_year" IS '지원년도'; COMMENT ON COLUMN "resume"."review_status" IS '심사 결정'; COMMENT ON COLUMN "resume"."review_comment" IS '검토 의견'; COMMENT ON COLUMN "resume"."reviewed_at" IS '검토 시간'; COMMENT ON COLUMN "resume"."created_at" IS '만들어진 시간'; COMMENT ON COLUMN "resume"."updated_at" IS '수정된 시간'`);

        await queryRunner.query(`CREATE TABLE "project" ("id" SERIAL NOT NULL, "resume_id" integer NOT NULL, "project_name" character varying(100) NOT NULL, "project_contribution" text NOT NULL, "project_date" date NOT NULL, "project_description" text NOT NULL, "project_tech_stack" text NOT NULL, CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id")); COMMENT ON COLUMN "project"."id" IS 'PK'; COMMENT ON COLUMN "project"."resume_id" IS 'FK'; COMMENT ON COLUMN "project"."project_name" IS '프로젝트명'; COMMENT ON COLUMN "project"."project_contribution" IS '참여율'; COMMENT ON COLUMN "project"."project_date" IS '발표년월'; COMMENT ON COLUMN "project"."project_description" IS '프로젝트 내용'; COMMENT ON COLUMN "project"."project_tech_stack" IS '사용 기술'`);

        await queryRunner.query(`CREATE TABLE "award" ("id" SERIAL NOT NULL, "resume_id" integer NOT NULL, "award_name" character varying(100) NOT NULL, "award_institution" character varying(100) NOT NULL, "award_date" date NOT NULL, "award_description" text NOT NULL, CONSTRAINT "PK_e887e4e69663925ebb60d3a7775" PRIMARY KEY ("id")); COMMENT ON COLUMN "award"."id" IS 'PK'; COMMENT ON COLUMN "award"."resume_id" IS 'FK'; COMMENT ON COLUMN "award"."award_name" IS '수상명'; COMMENT ON COLUMN "award"."award_institution" IS '수여 기관'; COMMENT ON COLUMN "award"."award_date" IS '취득 년월'; COMMENT ON COLUMN "award"."award_description" IS '수상 내용'`);

        await queryRunner.query(`CREATE TABLE "recruitment_settings" ("id" SERIAL NOT NULL, "start_date" TIMESTAMP, "end_date" TIMESTAMP, "is_application_enabled" boolean NOT NULL DEFAULT false, "auto_enable_on_start" boolean NOT NULL DEFAULT false, "auto_disable_on_end" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_39611265feff51549ca0cc0ce33" PRIMARY KEY ("id"))`);

        // === Foreign Keys ===
        await queryRunner.query(`ALTER TABLE "announcement" ADD CONSTRAINT "FK_394ec67088e7cd9c2fbbf113a5a" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Progress" ADD CONSTRAINT "FK_b809a880585e3c0f6d2795e5cd8" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Resource" ADD CONSTRAINT "FK_7ab14c453c85f7792dd4c3940ce" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Resource" ADD CONSTRAINT "FK_resource_progress_custom" FOREIGN KEY ("progress_id") REFERENCES "Progress"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "StudyMember" ADD CONSTRAINT "FK_6f9bb7ea5136bc0eab9507190f0" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "StudyMember" ADD CONSTRAINT "FK_2e48b3d9928394043c381ed33e3" FOREIGN KEY ("study_id") REFERENCES "Study"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_member" ADD CONSTRAINT "FK_0724b86622f89c433dee4cd8b17" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_member" ADD CONSTRAINT "FK_a1b5b4f5fa1b7f890d0a278748b" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_member" ADD CONSTRAINT "FK_2778947dcf7cf3e17e1fe713c3a" FOREIGN KEY ("team_role_id") REFERENCES "team_role"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_role" ADD CONSTRAINT "FK_1285dd0c5e0842dc7b57f5490d4" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team" ADD CONSTRAINT "FK_273a5ddfc2f86baf752c860d163" FOREIGN KEY ("leader_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project" ADD CONSTRAINT "FK_e2276f683202c78fb5a312e2188" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "award" ADD CONSTRAINT "FK_f26eebe05d9434053a186cab7ff" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // === Drop Foreign Keys ===
        await queryRunner.query(`ALTER TABLE "award" DROP CONSTRAINT "FK_f26eebe05d9434053a186cab7ff"`);
        await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "FK_e2276f683202c78fb5a312e2188"`);
        await queryRunner.query(`ALTER TABLE "team" DROP CONSTRAINT "FK_273a5ddfc2f86baf752c860d163"`);
        await queryRunner.query(`ALTER TABLE "team_role" DROP CONSTRAINT "FK_1285dd0c5e0842dc7b57f5490d4"`);
        await queryRunner.query(`ALTER TABLE "team_member" DROP CONSTRAINT "FK_2778947dcf7cf3e17e1fe713c3a"`);
        await queryRunner.query(`ALTER TABLE "team_member" DROP CONSTRAINT "FK_a1b5b4f5fa1b7f890d0a278748b"`);
        await queryRunner.query(`ALTER TABLE "team_member" DROP CONSTRAINT "FK_0724b86622f89c433dee4cd8b17"`);
        await queryRunner.query(`ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4"`);
        await queryRunner.query(`ALTER TABLE "StudyMember" DROP CONSTRAINT "FK_2e48b3d9928394043c381ed33e3"`);
        await queryRunner.query(`ALTER TABLE "StudyMember" DROP CONSTRAINT "FK_6f9bb7ea5136bc0eab9507190f0"`);
        await queryRunner.query(`ALTER TABLE "Resource" DROP CONSTRAINT "FK_resource_progress_custom"`);
        await queryRunner.query(`ALTER TABLE "Resource" DROP CONSTRAINT "FK_7ab14c453c85f7792dd4c3940ce"`);
        await queryRunner.query(`ALTER TABLE "Progress" DROP CONSTRAINT "FK_b809a880585e3c0f6d2795e5cd8"`);
        await queryRunner.query(`ALTER TABLE "announcement" DROP CONSTRAINT "FK_394ec67088e7cd9c2fbbf113a5a"`);

        // === Drop Tables ===
        await queryRunner.query(`DROP TABLE "recruitment_settings"`);
        await queryRunner.query(`DROP TABLE "resume"`);
        await queryRunner.query(`DROP TABLE "award"`);
        await queryRunner.query(`DROP TABLE "project"`);
        await queryRunner.query(`DROP TABLE "team"`);
        await queryRunner.query(`DROP TABLE "team_role"`);
        await queryRunner.query(`DROP TABLE "team_member"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "refresh_token"`);
        await queryRunner.query(`DROP TABLE "StudyMember"`);
        await queryRunner.query(`DROP TABLE "Study"`);
        await queryRunner.query(`DROP TABLE "Resource"`);
        await queryRunner.query(`DROP TABLE "Progress"`);
        await queryRunner.query(`DROP TABLE "announcement"`);

        // === Drop ENUM types ===
        await queryRunner.query(`DROP TYPE "public"."resume_review_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."team_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."team_execution_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_education_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_gender_enum"`);
    }

}
