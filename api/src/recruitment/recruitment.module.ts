import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { Resume } from './entities/resume.entity';
import { Award } from './entities/award.entity';
import { Project } from './entities/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resume, Award, Project]), // 엔티티를 Repository로 등록
  ],
  controllers: [RecruitmentController], // 이 모듈에서 사용할 컨트롤러를 등록
  providers: [RecruitmentService], // 이 모듈에서 사용할 서비스를 등록
})
export class RecruitmentModule {}
