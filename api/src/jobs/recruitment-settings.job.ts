import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecruitmentSettingsService } from '../recruitment/recruitment-settings.service';

@Injectable()
export class RecruitmentSettingsJob {
    private readonly logger = new Logger(RecruitmentSettingsJob.name);

    constructor(
        private readonly settingsService: RecruitmentSettingsService,
    ) { }

    /**
     * 매 분마다 실행하여 자동 활성화/비활성화 체크
     */
    @Cron('* * * * *')
    async checkRecruitmentAutomation() {
        try {
            await this.settingsService.checkAndUpdateAutomation();
        } catch (error) {
            this.logger.error(
                `Recruitment automation check failed: ${error.message}`,
                error.stack,
            );
        }
    }
}
