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
          const ext = utf8OriginalName.split('.').pop();
          cb(null, `${uniqueSuffix}.${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/markdown',
          'text/x-markdown',
          'text/plain',
        ];
        const utf8OriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = utf8OriginalName.split('.').pop()?.toLowerCase() ?? '';
        const allowedExtensions = ['pdf', 'docx', 'pptx', 'md'];
        if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, DOCX, PPTX, MD are allowed.`), false);
        }
      },
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
