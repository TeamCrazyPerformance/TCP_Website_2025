import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Study } from '../../study/entities/study.entity';
import { StudyMember } from '../../study/entities/study-member.entity';
import { StudyMemberRole } from '../../study/entities/enums/study-member-role.enum';
import { calculateStudyPeriodProgress } from './study-period';

@Injectable()
export class MyPageStudyService {
  constructor(
    @InjectRepository(Study)
    private readonly studyRepository: Repository<Study>,

    @InjectRepository(StudyMember)
    private readonly studyMemberRepository: Repository<StudyMember>,
  ) { }

  async findMyStudies(userId: string) {
    // 내가 속한 모든 스터디 조회 (MEMBER, LEADER, NOMINEE)
    const myStudyMembers = await this.studyMemberRepository.find({
      where: {
        user: { id: userId },
        role: In([StudyMemberRole.MEMBER, StudyMemberRole.LEADER, StudyMemberRole.NOMINEE]),
      },
      relations: ['study', 'study.studyMembers'],
      order: { study: { created_at: 'DESC' } },
    });

    // 진행중인 스터디, 완료된 스터디, 예정된 스터디 분리
    const ongoingStudies: any[] = [];
    const completedStudies: any[] = [];
    const upcomingStudies: any[] = [];

    for (const member of myStudyMembers) {
      const study = member.study;

      const periodProgress = calculateStudyPeriodProgress(study.period);

      const studyInfo = {
        id: study.id,
        study_name: study.study_name,
        period: study.period,
        memberCount: study.studyMembers?.length || 0,
        way: study.way,
        tag: study.tag,
        progress: periodProgress.progress,
      };

      if (periodProgress.status === 'upcoming') {
        upcomingStudies.push(studyInfo);
      } else if (periodProgress.status === 'completed') {
        completedStudies.push(studyInfo);
      } else {
        ongoingStudies.push(studyInfo);
      }
    }

    return {
      ongoingStudies,
      completedStudies,
      upcomingStudies,
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

    // 내가 멤버인지 확인 (MEMBER, LEADER, NOMINEE)
    const allowedRoles = [StudyMemberRole.MEMBER, StudyMemberRole.LEADER, StudyMemberRole.NOMINEE];
    const isMember = study.studyMembers.some(
      (member) =>
        member.user?.id === userId && allowedRoles.includes(member.role),
    );

    if (!isMember) {
      throw new ForbiddenException('Access denied: You are not a member of this study');
    }

    const { progress } = calculateStudyPeriodProgress(study.period);

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
