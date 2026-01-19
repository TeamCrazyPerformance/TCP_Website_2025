import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Study } from '../../study/entities/study.entity';
import { StudyMember } from '../../study/entities/study-member.entity';
import { StudyMemberRole } from '../../study/entities/enums/study-member-role.enum';

@Injectable()
export class MyPageStudyService {
  constructor(
    @InjectRepository(Study)
    private readonly studyRepository: Repository<Study>,

    @InjectRepository(StudyMember)
    private readonly studyMemberRepository: Repository<StudyMember>,
  ) {}

  async findMyStudies(userId: string) {
    // 내가 속한 모든 스터디 조회
    const myStudyMembers = await this.studyMemberRepository.find({
      where: {
        user: { id: userId },
        role: StudyMemberRole.MEMBER, // PENDING 제외
      },
      relations: ['study', 'study.studyMembers'],
      order: { study: { created_at: 'DESC' } },
    });

    // 현재 날짜
    const now = new Date();

    // 진행중인 스터디와 완료된 스터디 분리
    const ongoingStudies: any[] = [];
    const completedStudies: any[] = [];

    for (const member of myStudyMembers) {
      const study = member.study;
      
      // 기간 파싱 (예: "2024-01-01 ~ 2024-06-30")
      const periodMatch = study.period?.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
      
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let progress = 0;

      if (periodMatch) {
        startDate = new Date(periodMatch[1]);
        endDate = new Date(periodMatch[2]);

        // 진행률 계산
        if (startDate && endDate) {
          const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          progress = Math.min(Math.max(Math.round((elapsedDays / totalDays) * 100), 0), 100);
        }
      }

      const studyInfo = {
        id: study.id,
        study_name: study.study_name,
        period: study.period,
        memberCount: study.studyMembers?.length || 0,
        way: study.way,
        tag: study.tag,
      };

      // 종료일이 지났으면 완료, 아니면 진행중
      if (endDate && now > endDate) {
        completedStudies.push(studyInfo);
      } else {
        ongoingStudies.push(studyInfo);
      }
    }

    return {
      ongoingStudies,
      completedStudies,
    };
  }


  async findMyStudyDetail(userId: string, studyId: number) {
    const study = await this.studyRepository.findOne({
      where: { id: studyId },
      relations: ['studyMembers', 'studyMembers.user'],
    });

    if (!study) {
      throw new NotFoundException(`Study with id ${studyId} not found`);
    }

    // 내가 멤버인지 확인
    const isMember = study.studyMembers.some(
      (member) =>
        member.user.id === userId && member.role === StudyMemberRole.MEMBER,
    );

    if (!isMember) {
      throw new ForbiddenException('Access denied: You are not a member of this study');
    }

    // 기간 파싱
    const periodMatch = study.period?.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    
    let progress = 0;

    if (periodMatch) {
      const startDate = new Date(periodMatch[1]);
      const endDate = new Date(periodMatch[2]);
      const now = new Date();

      // 진행률 계산
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      progress = Math.min(Math.max(Math.round((elapsedDays / totalDays) * 100), 0), 100);
    }

    // 멤버 수 계산
    const memberCount = study.studyMembers.filter(
      (member) => member.role === StudyMemberRole.MEMBER,
    ).length;

    return {
      id: study.id,
      study_name: study.study_name,
      study_description: study.study_description,
      tag: study.tag,
      period: study.period,
      place: study.place,
      way: study.way,
      memberCount,
      progress,
    };
  }
}
