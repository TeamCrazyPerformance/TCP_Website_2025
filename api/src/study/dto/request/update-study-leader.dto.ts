import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateStudyLeaderDto {
  @IsNumber()
  @IsNotEmpty()
  user_id: number;
}
