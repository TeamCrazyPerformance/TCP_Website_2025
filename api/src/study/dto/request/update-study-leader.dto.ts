import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateStudyLeaderDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;
}
