import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateStudyDto {
  @IsString()
  @IsNotEmpty()
  study_name: string;

  @IsNumber()
  @Min(2000)
  start_year: number;

  @IsString()
  @IsNotEmpty()
  study_description: string;

  @IsNumber()
  @IsNotEmpty()
  leader_id: number;
}
