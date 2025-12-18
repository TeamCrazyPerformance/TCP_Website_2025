import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudyMemberRole } from '../entities/enums/study-member-role.enum';
import { StudyMember } from '../entities/study-member.entity';
import { STUDY_ROLES_KEY } from '../decorators/study-roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';

@Injectable()
export class StudyRolesGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectRepository(StudyMember)
        private studyMemberRepository: Repository<StudyMember>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<StudyMemberRole[]>(
            STUDY_ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // @StudyRoles() 데코레이터가 없으면 접근 허용
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // user가 없으면 접근 거부
        if (!user) {
            return false;
        }

        // ADMIN은 항상 접근 허용
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        // URL에서 studyId 추출
        const studyId = parseInt(request.params.id, 10);
        if (isNaN(studyId)) {
            return false;
        }

        // 해당 스터디에서 사용자의 멤버십 조회
        const studyMember = await this.studyMemberRepository.findOne({
            where: {
                study: { id: studyId },
                user: { id: user.id },
            },
        });

        // 멤버가 아니면 접근 거부
        if (!studyMember) {
            return false;
        }

        // 사용자의 스터디 역할이 요구되는 역할 중 하나와 일치하면 접근 허용
        return requiredRoles.includes(studyMember.role);
    }
}
