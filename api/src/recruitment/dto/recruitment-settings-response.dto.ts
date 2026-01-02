export class RecruitmentSettingsResponseDto {
    id: number;
    startDate: Date | null;
    endDate: Date | null;
    isApplicationEnabled: boolean;
    autoEnableOnStart: boolean;
    autoDisableOnEnd: boolean;
    updatedAt: Date;
}

export class RecruitmentStatusResponseDto {
    /** 현재 지원 가능 여부 */
    isApplicationEnabled: boolean;

    /** 모집 시작일 */
    startDate: Date | null;

    /** 모집 종료일 */
    endDate: Date | null;
}
