import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { Resume } from './entities/resume.entity';
import { Award } from './entities/award.entity';
import { Project } from './entities/project.entity';
import { RecruitmentSettings } from './entities/recruitment-settings.entity';
import { RecruitmentSettingsService } from './recruitment-settings.service';
import { RecruitmentSettingsController } from './recruitment-settings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resume, Award, Project, RecruitmentSettings]),
  ],
  controllers: [RecruitmentController, RecruitmentSettingsController],
  providers: [RecruitmentService, RecruitmentSettingsService],
  exports: [RecruitmentSettingsService],
})
export class RecruitmentModule { }
