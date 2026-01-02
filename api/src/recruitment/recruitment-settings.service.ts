import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
                startDate: null,
                endDate: null,
                isApplicationEnabled: false,
                autoEnableOnStart: false,
                autoDisableOnEnd: false,
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

        if (dto.startDate !== undefined) {
            settings.startDate = dto.startDate ? new Date(dto.startDate) : null;
        }
        if (dto.endDate !== undefined) {
            settings.endDate = dto.endDate ? new Date(dto.endDate) : null;
        }
        if (dto.isApplicationEnabled !== undefined) {
            settings.isApplicationEnabled = dto.isApplicationEnabled;
        }
        if (dto.autoEnableOnStart !== undefined) {
            settings.autoEnableOnStart = dto.autoEnableOnStart;
        }
        if (dto.autoDisableOnEnd !== undefined) {
            settings.autoDisableOnEnd = dto.autoDisableOnEnd;
        }

        const updated = await this.settingsRepository.save(settings);
        this.logger.log('Recruitment settings updated');

        return updated;
    }

    /**
     * 즉시 모집 시작
     */
    async startNow(): Promise<{ success: boolean; message: string }> {
        const settings = await this.getOrCreateSettings();
        settings.isApplicationEnabled = true;
        await this.settingsRepository.save(settings);

        this.logger.log('Recruitment started immediately');
        return { success: true, message: '모집이 시작되었습니다.' };
    }

    /**
     * 즉시 모집 중단
     */
    async stopNow(): Promise<{ success: boolean; message: string }> {
        const settings = await this.getOrCreateSettings();
        settings.isApplicationEnabled = false;
        await this.settingsRepository.save(settings);

        this.logger.log('Recruitment stopped immediately');
        return { success: true, message: '모집이 중단되었습니다.' };
    }

    /**
     * 공개 모집 상태 조회 (프론트엔드용)
     */
    async getPublicStatus(): Promise<RecruitmentStatusResponseDto> {
        const settings = await this.getOrCreateSettings();

        return {
            isApplicationEnabled: settings.isApplicationEnabled,
            startDate: settings.startDate,
            endDate: settings.endDate,
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
            settings.autoEnableOnStart &&
            settings.startDate &&
            settings.startDate <= now &&
            !settings.isApplicationEnabled
        ) {
            settings.isApplicationEnabled = true;
            updated = true;
            this.logger.log('Application automatically enabled (start date reached)');
        }

        // 종료일 경과 시 자동 비활성화
        if (
            settings.autoDisableOnEnd &&
            settings.endDate &&
            settings.endDate < now &&
            settings.isApplicationEnabled
        ) {
            settings.isApplicationEnabled = false;
            updated = true;
            this.logger.log('Application automatically disabled (end date passed)');
        }

        if (updated) {
            await this.settingsRepository.save(settings);
        }
    }
}
