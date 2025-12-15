import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProgressDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
