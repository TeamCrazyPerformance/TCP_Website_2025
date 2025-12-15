import {
  IsOptional,
  IsString,
  IsEmail,
  IsArray,
  IsEnum,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { UserGender } from '../../../members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../members/entities/enums/education-status.enum';


export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  student_number?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  major?: string;

  @IsOptional()
  @IsNumber()
  join_year?: number;

  @IsOptional()
  @IsDateString()
  birth_date?: Date;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tech_stack?: string[];

  @IsOptional()
  @IsEnum(EducationStatus)
  education_status?: EducationStatus;

  @IsOptional()
  @IsString()
  current_company?: string;

  @IsOptional()
  @IsString()
  baekjoon_username?: string;

  @IsOptional()
  @IsString()
  github_username?: string;

  @IsOptional()
  @IsString()
  self_description?: string;

  @IsOptional()
  is_public_current_company?: boolean;

  @IsOptional()
  is_public_github_username?: boolean;

  @IsOptional()
  is_public_email?: boolean;

  @IsOptional()
  @IsString()
  profile_image?: string;
}
