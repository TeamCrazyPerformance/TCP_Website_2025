import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  ArrayMaxSize,
  MaxLength,
  Matches,
} from 'class-validator';
import { EducationStatus } from '../../../members/entities/enums/education-status.enum';
import { UserGender } from '../../../members/entities/enums/user-gender.enum';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  major?: string;

  @IsOptional()
  @IsString()
  student_number?: string;

  @IsOptional()
  @IsString()
  current_company?: string;

  @IsOptional()
  @IsString()
  self_description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tech_stack?: string[];

  @IsOptional()
  @IsEnum(EducationStatus)
  education_status?: EducationStatus;

  @IsOptional()
  @IsString()
  github_username?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  portfolio_link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/\.(jpg|jpeg|png|gif|webp)$/i)
  profile_image?: string;

  // Extended Profile Fields
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @Type(() => Date)
  birth_date?: Date;

  @IsOptional()
  // @IsNumber() // Can be number or string from frontend, but simpler to use Number if possible.
  // Actually, join_year in Entity is number. Let's use IsNumber.
  // However, TypeORM/ClassValidator might need transformation if frontend sends string.
  // Let's assume frontend sends number or string that can be parsed.
  // Safest is to allow string or number and handle in service, or enforce logic.
  // Let's stick to simple types first.
  join_year?: number;

  @IsOptional()
  @IsString()
  baekjoon_username?: string;
}
