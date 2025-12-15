import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { TeamRole } from './entities/team-role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { TeamMember } from './entities/team-member.entity';
import { User } from '../members/entities/user.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamStatus } from './entities/enums/team-status.enum';
import { ApplyTeamDto } from './dto/apply-team.dto';
import { AddTeamRoleDto, UpdateTeamDto, UpdateTeamRoleDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
    constructor(
        @InjectRepository(Team)
        private readonly teamRepository: Repository<Team>,

        @InjectRepository(TeamRole)
        private readonly teamRoleRepository: Repository<TeamRole>,

        @InjectRepository(TeamMember)
        private readonly teamMemberRepository: Repository<TeamMember>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private dataSource: DataSource,
    ) {}

    // 모집글 생성
    async create(userId: number, dto:CreateTeamDto): Promise<Team>{
        const leader = await this.userRepository.findOneBy({id:userId});
        if(!leader) throw new NotFoundException('User not found');

        if (!dto.roles?.length) {
            throw new BadRequestException('At least one role is required');
        }

        // 🔍 역할 이름 중복 검사
        const roleNames = dto.roles.map(r => r.roleName.trim());
        const duplicates = roleNames.filter(
            (name, idx) => roleNames.indexOf(name) !== idx,
        );
        if (duplicates.length > 0) {
            throw new BadRequestException(
                `Duplicate role names not allowed: ${[...new Set(duplicates)].join(', ')}`,
            );
        }

        return this.dataSource.transaction(async (manager) => {
            // 팀 생성
            const team = manager.create(Team, { 
                ...dto, 
                leader,
                status: TeamStatus.OPEN,
                periodStart: new Date(dto.periodStart),
                periodEnd: new Date(dto.periodEnd),
                deadline: new Date(dto.deadline),
            });
            const savedTeam = await manager.save(team);

            // 역할 생성
            const roles = dto.roles.map((r) =>
                manager.create(TeamRole, {
                    team: savedTeam,
                    roleName: r.roleName,
                    recruitCount: r.recruitCount,
                    currentCount: 0,
                }),
            );
            await manager.save(roles);

            // 팀장 TeamMember 생성 및 연결
            const leaderMember = manager.create(TeamMember, {
                user: leader,
                team: savedTeam,
                role: null,
                isLeader: true,
            });
            await manager.save(leaderMember);

            // 최종 팀 정보 반환
            return manager.findOneOrFail(Team, {
                where: { id: savedTeam.id },
                relations: ['leader', 'roles', 'members'],
            });
        });
    }

    // 모집글 조회
    async findAll(): Promise<Team[]>{
        return this.teamRepository.find({
            relations:[
                'leader',
                'roles',                
            ],
            order: { createdAt: 'DESC' },
        });
    }

    // 모집글 상세 조회
    async findOne(id: number): Promise<Team> {
        const team = await this.teamRepository.findOne({
            where: { id },
            relations:[
                'leader',
                'roles',
            ],
        });

        if(!team) {
            throw new NotFoundException(`Team with id ${id} not found`);
        }

        return team;
    }

    // 모집글 수정
    async update(userId: number, teamId: number, dto: UpdateTeamDto): Promise<Team> {
        return this.dataSource.transaction(async (manager) => {
            const team = await manager.findOne(Team, {
                where: { id: teamId },
                relations: ['leader', 'roles'],
            });

            // 팀이 존재하는지, 그리고 요청자가 팀장인지 확인
            if (!team) {
                throw new NotFoundException(`Team ${teamId} not found`);
            }
            if (!team.leader || team.leader.id !== userId) {
              throw new ForbiddenException('Only the team leader can update this team');
            }

            // 팀 기본 정보 업데이트
            if (dto.title !== undefined) team.title = dto.title;
            if (dto.category !== undefined) team.category = dto.category;
            if (dto.periodStart !== undefined) team.periodStart = new Date(dto.periodStart);
            if (dto.periodEnd !== undefined) team.periodEnd = new Date(dto.periodEnd);
            if (dto.deadline !== undefined) team.deadline = new Date(dto.deadline);
            if (dto.description !== undefined) team.description = dto.description;
            if (dto.techStack !== undefined) team.techStack = dto.techStack;
            if (dto.tag !== undefined) team.tag = dto.tag;
            if (dto.goals !== undefined) team.goals = dto.goals;
            if (dto.executionType !== undefined) team.executionType = dto.executionType;
            if (dto.selectionProc !== undefined) team.selectionProc = dto.selectionProc;
            if (dto.link !== undefined) team.link = dto.link;
            if (dto.contact !== undefined) team.contact = dto.contact;
            if (dto.projectImage !== undefined) team.projectImage = dto.projectImage;

            // 기존 역할 수정 및 삭제를 처리
            if (dto.rolesToUpdate) {
                await this.processRoleUpdates(manager, team, dto.rolesToUpdate);
            }

            // 새로운 역할 추가를 처리
            if (dto.rolesToAdd) {
                await this.processRoleAdditions(manager, team, dto.rolesToAdd);
            }

            await manager.save(team);

            // 모든 변경사항을 반영한 후 업데이트된 팀 정보를 반환
            return manager.findOneOrFail(Team, {
                where: { id: teamId },
                relations: ['leader', 'roles'],
            });
        });
    }

    // 기존 역할의 수정/삭제를 처리하는 헬퍼 함수
    private async processRoleUpdates(manager: any,team: Team,rolesToUpdate: UpdateTeamRoleDto[],): Promise<void> {
        const existingRoleMap = new Map(team.roles.map(role => [role.id, role]));

        for (const roleDto of rolesToUpdate) {
            const existingRole = existingRoleMap.get(roleDto.id);
      
            if (!existingRole) {
                throw new BadRequestException(`Role with id ${roleDto.id} not found in this team`);
            }

            if (roleDto.action === 'delete') {
                await manager.delete(TeamRole, existingRole.id);
            } 
            else {
                // 이름 중복 검사를 위해 현재 팀의 다른 역할을 확인
                if (roleDto.roleName && roleDto.roleName !== existingRole.roleName) {
                    const nameConflict = team.roles.find(
                        (role) => role.roleName === roleDto.roleName && role.id !== existingRole.id,
                    );
                    if (nameConflict) {
                        throw new ConflictException(`Role name '${roleDto.roleName}' already exists.`);
                    }
                    existingRole.roleName = roleDto.roleName;
                }
        
                if (roleDto.recruitCount) {
                    existingRole.recruitCount = roleDto.recruitCount;
                }

                await manager.save(existingRole);
            }
        }
        
    }

    // 새로운 역할 추가를 처리하는 헬퍼 함수
    private async processRoleAdditions(manager: any, team: Team, rolesToAdd: AddTeamRoleDto[],): Promise<void> {
        const newRoles = rolesToAdd.map((roleDto) => {
            // 이름 중복을 확인
            const nameConflict = team.roles.find((role) => role.roleName === roleDto.roleName);
            if (nameConflict) {
                throw new ConflictException(`Role name '${roleDto.roleName}' already exists.`);
            }

            return manager.create(TeamRole, {
                team: team,
                roleName: roleDto.roleName,
                recruitCount: roleDto.recruitCount,
                currentCount: 0,
            });
        });

        const savedRoles = await manager.save(newRoles);

        if (!team.roles) {
          team.roles = [];
        }
        team.roles.push(...savedRoles);
    }

    // 모집글 삭제
    async remove(userId: number, id: number): Promise<void> {
        const team = await this.teamRepository.findOne({
            where: { id },
            relations: ['leader'],
        });

        if(!team) {
            throw new NotFoundException(`Team with id ${id} not found`);
        }

        if (!team.leader) {
            throw new ForbiddenException('This team has no leader and cannot be deleted.');
        }

        if (team.leader.id !== userId) {
            throw new ForbiddenException('You are not allowed to delete this team');
        }

        await this.teamRoleRepository.delete({ team: { id } });
        await this.teamMemberRepository.delete({ team: { id } });
        await this.teamRepository.delete(id);
    }

    // 모집 상태 변경
    async changeStatus(userId: number, id: number, status: TeamStatus): Promise<Team>{
        const team = await this.teamRepository.findOne({
            where: { id },
            relations: ['leader'],
        });

        if (!team) {
            throw new NotFoundException(`Team with id ${id} not found`);
        }
    
        if (!team.leader) {
            throw new ForbiddenException('This team has no leader and its status cannot be changed.');
        }
    
        if (team.leader.id !== userId) {
            throw new ForbiddenException('Only the team leader can change the status.');
        }

        team.status = status;
        return this.teamRepository.save(team);
    }

    // 팀 지원 (지원해도 해당 역할 인원수는 변화 X)
    async apply(userId: number, teamId: number, dto: ApplyTeamDto): Promise<TeamMember>{
        //  팀조회
        const team = await this.teamRepository.findOne({
            where: { id: teamId },
            relations: ['roles'],
        });
        if(!team){
            throw new NotFoundException(`Team with id ${teamId} not found`);
        }

        // 유저 조회
        const user = await this.userRepository.findOneBy({ id: userId });
        if(!user){
            throw new NotFoundException('User not found');
        }

        // 중복 지원 체크
        const existing = await this.teamMemberRepository.findOne({
             where: { user: { id: userId }, team: { id: teamId } },
        });
        if (existing) {
            throw new BadRequestException('You have already applied to this team');
        }

        // 역할 조회
        const role = await this.teamRoleRepository.findOneBy({ id: dto.roleId});
        if (!role) {
            throw new NotFoundException(`Role with id ${dto.roleId} not found`);
        }

        // 지원자 생성
        const member = this.teamMemberRepository.create({
            user,
            team,
            role,
            isLeader: false,
        });
        return this.teamMemberRepository.save(member);
    }

    // 팀 지원 취소(취소해도 해당 역할 인원수는 변화 X)
    async cancelApply(userId: number, teamId: number): Promise<void>{
        // 지원 내역 조회
        const member = await this.teamMemberRepository.findOne({
            where: { user: { id: userId }, team: { id: teamId } },
            relations: ['team', 'user'],
        });

        if(!member){
            throw new NotFoundException('Application not found');
        }

        if(member.isLeader){
            throw new ForbiddenException('Leader cannot cancel application');
        }

        await this.teamMemberRepository.delete(member.id);
    }
}
