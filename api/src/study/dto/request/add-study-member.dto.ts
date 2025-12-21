import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { StudyMemberRole } from '../../entities/enums/study-member-role.enum';

export class AddStudyMemberDto {
  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsEnum(StudyMemberRole)
  @IsNotEmpty()
  role: StudyMemberRole; // PENDING, MEMBER, LEADER
}
