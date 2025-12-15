import { IsNotEmpty, IsNumber } from 'class-validator';

export class AddStudyMemberDto {
  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsNotEmpty()
  role_name: string;
}
