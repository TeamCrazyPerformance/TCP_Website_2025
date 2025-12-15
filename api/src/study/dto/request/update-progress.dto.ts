import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateProgressDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;
}
