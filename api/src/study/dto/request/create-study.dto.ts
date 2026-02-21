import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsDateString, IsUUID, Matches } from 'class-validator';

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
  @Matches(/^\d{4}\.\d{2}\.\d{2} ~ \d{4}\.\d{2}\.\d{2}$/, {
    message: 'period는 "YYYY.MM.DD ~ YYYY.MM.DD" 형식이어야 합니다 (예: 2025.01.01 ~ 2025.12.31)',
  })
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
