import { IsIn, IsNotEmpty } from 'class-validator';

export class AdminMemberSearchQueryDto {
  @IsIn(['name', 'email', 'student_number', 'github_username', 'tech_stack'])
  type: string;

  @IsNotEmpty()
  word: string;
}
