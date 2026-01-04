import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateRecruitmentSettingsDto {
    /** 모집 시작일 (ISO 8601 형식) */
    @IsOptional()
    @IsDateString()
    start_date?: string | null;

    /** 모집 종료일 (ISO 8601 형식) */
    @IsOptional()
    @IsDateString()
    end_date?: string | null;

    /** 지원 버튼 활성화 여부 */
    @IsOptional()
    @IsBoolean()
    is_application_enabled?: boolean;

    /** 시작일 도달 시 자동 활성화 */
    @IsOptional()
    @IsBoolean()
    auto_enable_on_start?: boolean;

    /** 종료일 경과 시 자동 비활성화 */
    @IsOptional()
    @IsBoolean()
    auto_disable_on_end?: boolean;
}
