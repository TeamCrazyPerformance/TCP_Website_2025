import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberCleanupJob } from './member-cleanup.job';
import { RecruitmentSettingsJob } from './recruitment-settings.job';
import { User } from '../members/entities/user.entity';
import { RecruitmentModule } from '../recruitment/recruitment.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RecruitmentModule],
  providers: [MemberCleanupJob, RecruitmentSettingsJob],
})
export class JobsModule { }
