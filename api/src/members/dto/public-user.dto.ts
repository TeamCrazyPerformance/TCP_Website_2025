import { IsString, IsEmail, IsArray, IsOptional, IsUrl } from 'class-validator';

export class PublicUserDto {
  @IsString()
  name: string;

  @IsString()
  profile_image: string;

  @IsString()
  @IsOptional()
  self_description: string | null;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsOptional()
  tech_stack?: string[] | null;

  @IsString()
  @IsOptional()
  education_status?: string | null;

  @IsString()
  @IsOptional()
  github_username?: string;

  @IsUrl()
  @IsOptional()
  portfolio_link?: string | null;
}
