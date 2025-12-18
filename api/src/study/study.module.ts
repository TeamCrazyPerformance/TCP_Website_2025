import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { StudyController } from './study.controller';
import { StudyService } from './study.service';
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
  ],
  controllers: [StudyController],
  providers: [StudyService, StudyRolesGuard],
  exports: [StudyService, StudyRolesGuard],
})
export class StudyModule { }
