import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacyDto {
  @IsOptional()
  @IsBoolean()
  is_public_email?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public_tech_stack?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public_github_username?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public_portfolio_link?: boolean;

  @IsOptional()
  @IsBoolean()
  is_public_current_company?: boolean;
}
