import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';

import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { ResourceCleanupService } from './resource-cleanup.service';
import { StudyRolesGuard } from './guards/study-roles.guard';

import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { StudyMember } from './entities/study-member.entity';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Study, User, StudyMember, Progress, Resource]),
    MulterModule.register({
      dest: './uploads',
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [StudyController],
  providers: [StudyService, ResourceCleanupService, StudyRolesGuard],
  exports: [StudyService, StudyRolesGuard],
})
export class StudyModule { }
