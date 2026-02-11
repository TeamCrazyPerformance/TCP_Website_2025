import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

// awards 배열의 각 객체에 대한 DTO
class AwardDto {
  @IsString()
  @IsNotEmpty()
  award_name: string;

  @IsString()
  @IsNotEmpty()
  award_institution: string;

  @IsDateString()
  @IsNotEmpty()
  award_date: string;

  @IsString()
  @IsNotEmpty()
  award_description: string;
}

// projects 배열의 각 객체에 대한 DTO
class ProjectDto {
  @IsString()
  @IsNotEmpty()
  project_name: string;

  @IsString()
  @IsNotEmpty()
  project_contribution: string;

  @IsDateString()
  @IsNotEmpty()
  project_date: string;

  @IsString()
  @IsNotEmpty()
  project_description: string;

  @IsString()
  @IsNotEmpty()
  project_tech_stack: string;
}

// 메인 요청 Body에 대한 DTO
export class CreateRecruitmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  student_number: string;

  @IsString()
  @IsNotEmpty()
  major: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0\d{1,2}-\d{3,4}-\d{4}$/, {
    message: '전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678, 02-123-4567)',
  })
  phone_number: string;

  @IsOptional()
  @IsString()
  tech_stack?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AwardDto)
  awards?: AwardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  projects?: ProjectDto[];

  @IsString()
  @IsNotEmpty()
  area_interest: string;

  @IsString()
  @IsNotEmpty()
  self_introduction: string;

  @IsString()
  @IsNotEmpty()
  club_expectation: string;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  submit_year: number;
}
