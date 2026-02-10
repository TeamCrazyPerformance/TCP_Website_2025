import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecruitmentSettings } from './entities/recruitment-settings.entity';
import { UpdateRecruitmentSettingsDto } from './dto/update-recruitment-settings.dto';
import {
    RecruitmentSettingsResponseDto,
    RecruitmentStatusResponseDto,
} from './dto/recruitment-settings-response.dto';

@Injectable()
export class RecruitmentSettingsService {
    private readonly logger = new Logger(RecruitmentSettingsService.name);

    constructor(
        @InjectRepository(RecruitmentSettings)
        private readonly settingsRepository: Repository<RecruitmentSettings>,
    ) { }

    /**
     * 설정을 조회하거나 없으면 기본값으로 생성
     */
    async getOrCreateSettings(): Promise<RecruitmentSettings> {
        let settings = await this.settingsRepository.findOne({ where: {} });

        if (!settings) {
            this.logger.log('Creating default recruitment settings');
            settings = this.settingsRepository.create({
                start_date: null,
                end_date: null,
                is_application_enabled: false,
                auto_enable_on_start: false,
                auto_disable_on_end: false,
            });
            settings = await this.settingsRepository.save(settings);
        }

        return settings;
    }

    /**
     * 현재 설정 조회 (Admin용)
     */
    async getSettings(): Promise<RecruitmentSettingsResponseDto> {
        const settings = await this.getOrCreateSettings();
        return settings;
    }

    /**
     * 설정 업데이트
     */
    async updateSettings(
        dto: UpdateRecruitmentSettingsDto,
    ): Promise<RecruitmentSettingsResponseDto> {
        const settings = await this.getOrCreateSettings();

        if (dto.start_date !== undefined) {
            if (dto.start_date) {
                const startDate = new Date(dto.start_date);
                startDate.setHours(0, 0, 0, 0);
                settings.start_date = startDate;
            } else {
                settings.start_date = null;
            }
        }
        if (dto.end_date !== undefined) {
            if (dto.end_date) {
                const endDate = new Date(dto.end_date);
                endDate.setHours(23, 59, 59, 999);
                settings.end_date = endDate;
            } else {
                settings.end_date = null;
            }
        }
        if (dto.is_application_enabled !== undefined) {
            settings.is_application_enabled = dto.is_application_enabled;
        }
        if (dto.auto_enable_on_start !== undefined) {
            settings.auto_enable_on_start = dto.auto_enable_on_start;
        }
        if (dto.auto_disable_on_end !== undefined) {
            settings.auto_disable_on_end = dto.auto_disable_on_end;
        }

        const updated = await this.settingsRepository.save(settings);
        this.logger.log('Recruitment settings updated');

        return updated;
    }

    /**
     * 즉시 모집 시작 (오늘부터 3주간)
     */
    async startNow(): Promise<{ success: boolean; message: string; start_date: Date; end_date: Date }> {
        const settings = await this.getOrCreateSettings();

        // 오늘 날짜 (시간은 00:00:00으로 설정)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 3주 후 날짜
        const threeWeeksLater = new Date(today);
        threeWeeksLater.setDate(threeWeeksLater.getDate() + 21);

        settings.start_date = today;
        threeWeeksLater.setHours(23, 59, 59, 999);
        settings.end_date = threeWeeksLater;
        settings.is_application_enabled = true;
        await this.settingsRepository.save(settings);

        this.logger.log('Recruitment started immediately with 3-week period');
        return {
            success: true,
            message: '모집이 시작되었습니다. (오늘부터 3주간)',
            start_date: today,
            end_date: threeWeeksLater
        };
    }

    /**
     * 즉시 모집 중단 (종료일을 오늘로 변경)
     */
    async stopNow(): Promise<{ success: boolean; message: string; end_date: Date }> {
        const settings = await this.getOrCreateSettings();

        // 오늘 날짜 (시간은 00:00:00으로 설정)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        settings.end_date = today;
        settings.is_application_enabled = false;
        await this.settingsRepository.save(settings);

        this.logger.log('Recruitment stopped immediately, end date set to today');
        return {
            success: true,
            message: '모집이 중단되었습니다. (종료일: 오늘)',
            end_date: today
        };
    }

    /**
     * 공개 모집 상태 조회 (프론트엔드용)
     */
    async getPublicStatus(): Promise<RecruitmentStatusResponseDto> {
        const settings = await this.getOrCreateSettings();

        return {
            is_application_enabled: settings.is_application_enabled,
            start_date: settings.start_date,
            end_date: settings.end_date,
        };
    }

    /**
     * 자동화 체크 (Cron Job에서 호출)
     */
    async checkAndUpdateAutomation(): Promise<void> {
        const settings = await this.settingsRepository.findOne({ where: {} });

        if (!settings) {
            return;
        }

        const now = new Date();
        let updated = false;

        // 시작일 도달 시 자동 활성화
        if (
            settings.auto_enable_on_start &&
            settings.start_date &&
            settings.start_date <= now &&
            !settings.is_application_enabled
        ) {
            settings.is_application_enabled = true;
            updated = true;
            this.logger.log('Application automatically enabled (start date reached)');
        }

        // 종료일 경과 시 자동 비활성화
        if (
            settings.auto_disable_on_end &&
            settings.end_date &&
            settings.end_date < now &&
            settings.is_application_enabled
        ) {
            settings.is_application_enabled = false;
            updated = true;
            this.logger.log('Application automatically disabled (end date passed)');
        }

        if (updated) {
            await this.settingsRepository.save(settings);
        }
    }
}
