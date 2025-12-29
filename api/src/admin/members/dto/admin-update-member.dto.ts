import {
  IsOptional,
  IsString,
  IsInt,
  IsDateString,
  IsEnum,
  IsEmail,
} from 'class-validator';
import { EducationStatus } from '../../../members/entities/enums/education-status.enum';
import { UserGender } from '../../../members/entities/enums/user-gender.enum';

export class AdminUpdateMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  student_number?: string;

  @IsOptional()
  @IsString()
  profile_image?: string;

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
  @IsInt()
  join_year?: number;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @IsEnum(EducationStatus)
  education_status?: EducationStatus;
}
