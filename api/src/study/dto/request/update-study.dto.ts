import { IsNumber, IsOptional, IsString, Min, IsDateString, Matches } from 'class-validator';

export class UpdateStudyDto {
    @IsString()
    @IsOptional()
    study_name?: string;

    @IsNumber()
    @Min(2000)
    @IsOptional()
    start_year?: number;

    @IsString()
    @IsOptional()
    study_description?: string;

    @IsString()
    @IsOptional()
    tag?: string;

    @IsNumber()
    @IsOptional()
    recruit_count?: number;

    @IsString()
    @IsOptional()
    @Matches(/^\d{4}\.\d{2}\.\d{2} ~ \d{4}\.\d{2}\.\d{2}$/, {
        message: 'period는 "YYYY.MM.DD ~ YYYY.MM.DD" 형식이어야 합니다 (예: 2025.01.01 ~ 2025.12.31)',
    })
    period?: string;

    @IsDateString()
    @IsOptional()
    apply_deadline?: string;

    @IsString()
    @IsOptional()
    place?: string;

    @IsString()
    @IsOptional()
    way?: string;
}
