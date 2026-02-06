import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { AdminUpdateMemberDto } from './dto/admin-update-member.dto';
import { StudyMember } from '../../study/entities/study-member.entity';
import { TeamMember } from '../../teams/entities/team-member.entity';
import { StudyMemberRole } from '../../study/entities/enums/study-member-role.enum';

@Injectable()
export class AdminMembersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StudyMember)
    private readonly studyMemberRepository: Repository<StudyMember>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) { }

  // 관리자용 멤버 전체 조회 (soft delete 된 멤버는 제외)
  async findAllMembers() {
    const members = await this.userRepository.find({
      where: {
        deleted_at: IsNull(),
      },
      select: [
        'id',
        'username',
        'name',
        'student_number',
        'profile_image',
        'phone_number',
        'email',
        'major',
        'role',
        'join_year',
        'birth_date',
        'gender',
        'tech_stack',
        'education_status',
        'created_at',
      ],
      order: {
        name: 'ASC',
      },
    });

    return members.map(member => {
      if (member.profile_image && member.profile_image !== 'default_profile_image.png') {
        if (!member.profile_image.startsWith('http')) {
          member.profile_image = `/profiles/${member.profile_image}`;
        }
      } else {
        (member as any).profile_image = null;
      }
      return member;
    });
  }

  async updateMember(id: string, dto: AdminUpdateMemberDto) {
    const user = await this.userRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않거나 삭제된 회원입니다.');
    }

    await this.userRepository.update(
      { id, deleted_at: IsNull() },
      dto,
    );

    const updatedUser = await this.userRepository.findOne({
      where: { id, deleted_at: IsNull() },
    });

    if (!updatedUser) {
      throw new NotFoundException('회원 정보를 불러오는데 실패했습니다.');
    }

    if (updatedUser.profile_image && updatedUser.profile_image !== 'default_profile_image.png') {
      if (!updatedUser.profile_image.startsWith('http')) {
        updatedUser.profile_image = `/profiles/${updatedUser.profile_image}`;
      }
    } else {
      (updatedUser as any).profile_image = null;
    }

    return updatedUser;
  }

  async deleteMember(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        id,
        deleted_at: IsNull(),
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않거나 이미 삭제된 회원입니다.');
    }

    // 1. 스터디장 여부 확인
    const studyLeader = await this.studyMemberRepository.findOne({
      where: {
        user: { id },
        role: StudyMemberRole.LEADER,
      },
      relations: ['study'],
    });

    if (studyLeader) {
      throw new BadRequestException(
        `삭제할 수 없습니다. 해당 회원은 스터디 '${studyLeader.study.study_name}'의 스터디장입니다. 스터디장을 위임하거나 스터디를 삭제해주세요.`,
      );
    }

    // 2. 팀장 여부 확인
    const teamLeader = await this.teamMemberRepository.findOne({
      where: {
        user: { id },
        isLeader: true,
      },
      relations: ['team'],
    });

    if (teamLeader) {
      throw new BadRequestException(
        `삭제할 수 없습니다. 해당 회원은 팀 '${teamLeader.team.title}'의 팀장입니다. 팀장을 위임하거나 팀을 삭제해주세요.`,
      );
    }

    // 3. 스터디 마지막 멤버 여부 확인
    const studyMemberships = await this.studyMemberRepository.find({
      where: { user: { id } },
      relations: ['study'],
    });

    for (const membership of studyMemberships) {
      const count = await this.studyMemberRepository.count({
        where: { study: { id: membership.study.id } },
      });
      if (count === 1) {
        throw new BadRequestException(
          `삭제할 수 없습니다. 해당 회원은 스터디 '${membership.study.study_name}'의 마지막 멤버입니다. 스터디를 먼저 삭제해주세요.`,
        );
      }
    }

    // 4. 팀 마지막 멤버 여부 확인
    const teamMemberships = await this.teamMemberRepository.find({
      where: { user: { id } },
      relations: ['team'],
    });

    for (const membership of teamMemberships) {
      const count = await this.teamMemberRepository.count({
        where: { team: { id: membership.team.id } },
      });
      if (count === 1) {
        throw new BadRequestException(
          `삭제할 수 없습니다. 해당 회원은 팀 '${membership.team.title}'의 마지막 멤버입니다. 팀을 먼저 삭제해주세요.`,
        );
      }
    }

    await this.userRepository.softRemove(user);
  }
}
