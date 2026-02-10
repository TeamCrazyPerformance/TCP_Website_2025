import { StudyMemberRole } from '../../entities/enums/study-member-role.enum';

export class StudyMemberResponseDto {
  user_id: string;
  name: string;
  role: StudyMemberRole; // PENDING, MEMBER, LEADER
  profile_image?: string | null;
  major?: string | null;
  self_description?: string | null;
  intro?: string | null;
}
