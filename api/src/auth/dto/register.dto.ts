import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { EducationStatus } from '../../members/entities/enums/education-status.enum';
import { UserGender } from '../../members/entities/enums/user-gender.enum';

export class RegisterDto {
  @IsString() @Length(3, 50)
  username: string;

  @IsString() @Length(8, 255)
  password: string;

  @IsString() @Length(1, 50)
  name: string;

  @IsString() @Length(1, 20)
  student_number: string;

  @IsOptional() @IsString() @MaxLength(255)
  profile_image?: string;

  @IsString() @Length(1, 20)
  phone_number: string;

  @IsEmail() @MaxLength(255)
  email: string;

  @IsString() @MaxLength(100)
  major: string;

  @IsNumber()
  join_year: number;

  @IsDateString()
  birth_date: string; // "YYYY-MM-DD" 형식의 문자열로 받음 파싱해서 Date로 변환 후 DB에 저장

  @IsEnum(UserGender)
  gender: UserGender;

  @IsOptional() @IsArray()
  tech_stack?: string[];

  @IsEnum(EducationStatus)
  education_status: EducationStatus;

  @IsOptional() @IsString() @MaxLength(255)
  current_company?: string;

  @IsOptional() @IsString() @MaxLength(255)
  baekjoon_username?: string;

  @IsOptional() @IsString() @MaxLength(255)
  github_username?: string;

  @IsOptional() @IsString()
  self_description?: string;

  @IsOptional() @IsBoolean()
  is_public_current_company?: boolean;

  @IsOptional() @IsBoolean()
  is_public_github_username?: boolean;

  @IsOptional() @IsBoolean()
  is_public_baekjoon_username?: boolean;

  @IsOptional() @IsBoolean()
  is_public_email?: boolean;
}
