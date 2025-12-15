import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { StudyController } from './study.controller';
import { StudyService } from './study.service';

import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { Role } from './entities/role.entity';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Study, User, Role, Progress, Resource]),
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
