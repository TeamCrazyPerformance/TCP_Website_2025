export class RecruitmentSettingsResponseDto {
    id: number;
    start_date: Date | null;
    end_date: Date | null;
    is_application_enabled: boolean;
    auto_enable_on_start: boolean;
    auto_disable_on_end: boolean;
    updated_at: Date;
}

export class RecruitmentStatusResponseDto {
    /** 현재 지원 가능 여부 */
    is_application_enabled: boolean;

    /** 모집 시작일 */
    start_date: Date | null;

    /** 모집 종료일 */
    end_date: Date | null;
}
