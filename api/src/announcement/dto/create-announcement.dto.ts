import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  contents: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsOptional() // 지정하지 않으면 현재 시각으로 처리할 수도 있음
  @IsDateString() // 문자열이지만 ISO8601 날짜 형식 검증
  publishAt?: string;
}
