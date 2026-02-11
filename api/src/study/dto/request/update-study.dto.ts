import { IsNumber, IsOptional, IsString, Min, IsDateString } from 'class-validator';

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
