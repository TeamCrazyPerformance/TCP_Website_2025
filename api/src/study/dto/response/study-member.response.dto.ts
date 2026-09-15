import { StudyMemberRole } from '../../entities/enums/study-member-role.enum';

export class StudyMemberResponseDto {
  user_id?: string;
  name: string;
  major?: string | null;
  role: StudyMemberRole; // PENDING, MEMBER, LEADER
}
