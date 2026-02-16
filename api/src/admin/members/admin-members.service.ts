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
import { UserRole } from '../../members/entities/enums/user-role.enum';

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

  private readonly defaultImages = [
    'default_profile_image.png',
    'default_profile_image.webp',
    'default_graduate_profile_image.webp',
    'default_admin_profile_image.webp'
  ];

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

    // ------------------------------------------------------------------
    // 상태/역할 변경 시 기본 이미지 자동 업데이트 로직 (커스텀 이미지는 유지)
    // ------------------------------------------------------------------
    // 주의: update() 직후에는 메모리 상의 user 객체가 업데이트되지 않았으므로
    // 변경된 dto 내용을 바탕으로 판단해야 함.
    // 하지만 이미지가 '기본 이미지'인지 확인하려면 DB의 최신 상태(또는 이전 상태)가 필요함.
    // 위에서 조회한 `user`는 업데이트 전 상태임.

    if (this.defaultImages.includes(user.profile_image)) {
      let shouldUpdateImage = false;
      let newImageName = user.profile_image;

      // 1. 역할이 변경된 경우
      if (dto.role && dto.role !== user.role) {
        shouldUpdateImage = true;
        if (dto.role === UserRole.ADMIN) {
          newImageName = 'default_admin_profile_image.webp';
        } else {
          // Admin -> Member/Guest 등
          // 학적 상태도 고려해야 함 (졸업생인지)
          const currentEduStatus = dto.education_status ?? user.education_status;
          if (currentEduStatus === '졸업') {
            newImageName = 'default_graduate_profile_image.webp';
          } else {
            newImageName = 'default_profile_image.webp';
          }
        }
      }

      // 2. 학적 상태가 변경된 경우 (역할 변경이 없거나, 역할이 Admin이 아닌 경우)
      // (역할이 Admin으로 바뀌었다면 위에서 이미 처리됨)
      if (dto.education_status && dto.education_status !== user.education_status) {
        const currentRole = dto.role ?? user.role;
        if (currentRole !== UserRole.ADMIN) { // Admin은 항상 Admin 이미지 우선
          shouldUpdateImage = true;
          if (dto.education_status === '졸업') {
            newImageName = 'default_graduate_profile_image.webp';
          } else {
            newImageName = 'default_profile_image.webp';
          }
        }
      }

      if (shouldUpdateImage && newImageName !== user.profile_image) {
        await this.userRepository.update({ id }, { profile_image: newImageName });
      }
    }
    // ------------------------------------------------------------------

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

    // 스터디 멤버십 삭제
    await this.studyMemberRepository.delete({ user: { id } });

    // 팀 멤버십 삭제
    await this.teamMemberRepository.delete({ user: { id } });

    await this.userRepository.softRemove(user);
  }
}
