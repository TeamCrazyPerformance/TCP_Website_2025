import * as path from 'path';
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
      storage: require('multer').diskStorage({
        destination: './uploads/resources',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const utf8OriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const ext = path.extname(utf8OriginalName).replace('.', '');
          cb(null, `${uniqueSuffix}.${ext}`);
        },
      }),

      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [StudyController],
  providers: [StudyService, ResourceCleanupService, StudyRolesGuard],
  exports: [StudyService, StudyRolesGuard],
})
export class StudyModule { }
