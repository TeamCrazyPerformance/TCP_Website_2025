import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsDateString, IsUUID } from 'class-validator';

export class CreateStudyDto {
  @IsString()
  @IsNotEmpty()
  study_name: string;

  @IsNumber()
  @Min(2000)
  start_year: number;

  @IsString()
  @IsOptional()
  study_description?: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsNumber()
  @IsOptional()
  recruit_count?: number;

  @IsString()
  @IsOptional()
  period?: string;

  @IsDateString()
  @IsNotEmpty()
  apply_deadline: string;

  @IsString()
  @IsOptional()
  place?: string;

  @IsString()
  @IsOptional()
  way?: string;

  @IsUUID()
  @IsNotEmpty()
  leader_id: string;
}
