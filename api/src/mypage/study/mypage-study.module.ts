import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyPageStudyController } from './mypage-study.controller';
import { MyPageStudyService } from './mypage-study.service';
import { Study } from '../../study/entities/study.entity';
import { StudyMember } from '../../study/entities/study-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Study, StudyMember])],
  controllers: [MyPageStudyController],
  providers: [MyPageStudyService],
  exports: [MyPageStudyService],
})
export class MyPageStudyModule {}
