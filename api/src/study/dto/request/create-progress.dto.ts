import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';

export class CreateProgressDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNotEmpty()
  weekNo: number;

  @IsNotEmpty()
  progressDate: Date;

  @IsOptional()
  @IsArray()
  resourceIds?: number[];
}
