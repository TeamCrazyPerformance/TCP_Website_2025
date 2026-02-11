import { SetMetadata } from '@nestjs/common';
import { StudyMemberRole } from '../entities/enums/study-member-role.enum';

export const STUDY_ROLES_KEY = 'study-roles';
export const StudyRoles = (...roles: StudyMemberRole[]) =>
    SetMetadata(STUDY_ROLES_KEY, roles);
