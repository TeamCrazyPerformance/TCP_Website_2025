import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateRecruitmentSettingsDto {
    /** 모집 시작일 (ISO 8601 형식) */
    @IsOptional()
    @IsDateString()
    startDate?: string | null;

    /** 모집 종료일 (ISO 8601 형식) */
    @IsOptional()
    @IsDateString()
    endDate?: string | null;

    /** 지원 버튼 활성화 여부 */
    @IsOptional()
    @IsBoolean()
    isApplicationEnabled?: boolean;

    /** 시작일 도달 시 자동 활성화 */
    @IsOptional()
    @IsBoolean()
    autoEnableOnStart?: boolean;

    /** 종료일 경과 시 자동 비활성화 */
    @IsOptional()
    @IsBoolean()
    autoDisableOnEnd?: boolean;
}
