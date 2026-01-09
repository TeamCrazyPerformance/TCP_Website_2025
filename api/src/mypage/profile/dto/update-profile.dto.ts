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

export class UpdateProfileDto {
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
}
