import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../members/entities/user.entity';
import { WithdrawDto } from './dto/withdraw.dto';
import { StudyMember } from '../../study/entities/study-member.entity';
import { StudyMemberRole } from '../../study/entities/enums/study-member-role.enum';
import { TeamMember } from '../../teams/entities/team-member.entity';

@Injectable()
export class WithdrawService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StudyMember)
    private readonly studyMemberRepository: Repository<StudyMember>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) { }

  async verifyPassword(userId: string, dto: WithdrawDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    return { verified: true };
  }

  async withdraw(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 1. 스터디 리더인지 확인
    const leaderStudies = await this.studyMemberRepository.find({
      where: {
        user: { id: userId },
        role: StudyMemberRole.LEADER,
      },
      relations: ['study'],
    });

    if (leaderStudies.length > 0) {
      const studyNames = leaderStudies.map(sm => sm.study.study_name).join(', ');
      throw new BadRequestException(
        `스터디 리더로 활동 중인 스터디가 있습니다: ${studyNames}. 탈퇴 전에 스터디장을 다른 멤버에게 위임하거나 스터디를 삭제해주세요.`
      );
    }

    // 2. 스터디의 유일한 멤버인지 확인
    const memberStudies = await this.studyMemberRepository.find({
      where: {
        user: { id: userId },
        role: StudyMemberRole.MEMBER,
      },
      relations: ['study', 'study.studyMembers'],
    });

    for (const membership of memberStudies) {
      const activeMembers = membership.study.studyMembers.filter(
        sm => sm.role === StudyMemberRole.MEMBER || sm.role === StudyMemberRole.LEADER
      );
      if (activeMembers.length === 1) {
        throw new BadRequestException(
          `스터디 '${membership.study.study_name}'의 유일한 멤버입니다. 탈퇴 전에 다른 멤버를 초대하거나 스터디를 삭제해주세요.`
        );
      }
    }

    // 3. 팀 리더인지 확인
    const leaderTeams = await this.teamMemberRepository.find({
      where: {
        user: { id: userId },
        isLeader: true,
      },
      relations: ['team'],
    });

    if (leaderTeams.length > 0) {
      const teamNames = leaderTeams.map(tm => tm.team.title).join(', ');
      throw new BadRequestException(
        `팀 리더로 활동 중인 팀이 있습니다: ${teamNames}. 탈퇴 전에 팀장을 다른 멤버에게 위임하거나 팀을 삭제해주세요.`
      );
    }

    // 4. 팀의 유일한 멤버인지 확인
    const memberTeams = await this.teamMemberRepository.find({
      where: {
        user: { id: userId },
      },
      relations: ['team', 'team.members'],
    });

    for (const membership of memberTeams) {
      if (membership.team.members.length === 1) {
        throw new BadRequestException(
          `팀 '${membership.team.title}'의 유일한 멤버입니다. 탈퇴 전에 다른 멤버를 초대하거나 팀을 삭제해주세요.`
        );
      }
    }

    // 스터디 멤버십 삭제
    await this.studyMemberRepository.delete({ user: { id: userId } });

    // 팀 멤버십은 onDelete: CASCADE로 자동 삭제됨

    await this.userRepository.softRemove(user);

    return { success: true, message: '회원탈퇴가 완료되었습니다.' };
  }
}
