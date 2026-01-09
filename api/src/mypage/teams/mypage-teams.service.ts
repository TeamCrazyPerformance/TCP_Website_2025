import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { TeamMember } from '../../teams/entities/team-member.entity';
import { TeamStatus } from '../../teams/entities/enums/team-status.enum';

@Injectable()
export class MyPageTeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,

    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) {}

  async findMyTeams(userId: string) {
    // 내가 모집중인 팀 (내가 리더인 팀)
    const recruitingTeams = await this.teamRepository.find({
      where: {
        leader: { id: userId },
        status: TeamStatus.OPEN,
      },
      relations: ['leader', 'roles'],
      order: { createdAt: 'DESC' },
    });

    // 내가 지원한 팀 (나를 제외한 모든 팀)
    const appliedTeamMembers = await this.teamMemberRepository.find({
      where: {
        user: { id: userId },
        isLeader: false,
      },
      relations: ['team', 'team.leader', 'team.roles', 'role'],
      order: { team: { createdAt: 'DESC' } },
    });

    const appliedTeams = appliedTeamMembers.map((member) => ({
      ...member.team,
      appliedRole: member.role,
    }));

    // 내가 속해있으면서 모집 완료된 팀
    const completedTeamMembers = await this.teamMemberRepository.find({
      where: {
        user: { id: userId },
        team: { status: TeamStatus.CLOSED },
      },
      relations: ['team', 'team.leader', 'team.roles', 'role'],
      order: { team: { createdAt: 'DESC' } },
    });

    const completedTeams = completedTeamMembers.map((member) => ({
      ...member.team,
      myRole: member.role,
      isLeader: member.isLeader,
    }));

    return {
      recruitingTeams, // 내가 모집중인 팀
      appliedTeams,    // 내가 지원한 팀
      completedTeams,  // 내가 속한 완료된 팀
    };
  }

  async findMyTeamDetail(userId: string, teamId: number) {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['leader', 'roles', 'members', 'members.user', 'members.role'],
    });

    if (!team) {
      throw new NotFoundException(`Team with id ${teamId} not found`);
    }

    const isLeader = team.leader?.id === userId;
    const isMember = team.members.some((member) => member.user.id === userId);

    if (!isLeader && !isMember) {
      throw new ForbiddenException('Access denied: You are not a member of this team');
    }

    // 기본 팀 정보
    const teamDetail = {
      id: team.id,
      title: team.title,
      category: team.category,
      periodStart: team.periodStart,
      periodEnd: team.periodEnd,
      deadline: team.deadline,
      description: team.description,
      techStack: team.techStack,
      tag: team.tag,
      goals: team.goals,
      executionType: team.executionType,
      selectionProc: team.selectionProc,
      link: team.link,
      contact: team.contact,
      status: team.status,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      projectImage: team.projectImage,
      leader: team.leader,
      roles: team.roles,
      isLeader,
    };

    // 내가 리더인 경우 지원자 정보 추가
    if (isLeader) {
      const applicants = team.members
        .filter((member) => !member.isLeader)
        .map((member) => ({
          id: member.id,
          name: member.user.name,
          phoneNumber: member.user.phone_number,
          email: member.user.email,
          role: member.role,
        }));

      return {
        ...teamDetail,
        applicants,
      };
    }

    return teamDetail;
  }
}
