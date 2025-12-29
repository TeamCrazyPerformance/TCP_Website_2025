import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { StudyMemberRole } from '../../entities/enums/study-member-role.enum';

export class AddStudyMemberDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsEnum(StudyMemberRole)
  @IsNotEmpty()
  role: StudyMemberRole; // PENDING, MEMBER, LEADER
}
