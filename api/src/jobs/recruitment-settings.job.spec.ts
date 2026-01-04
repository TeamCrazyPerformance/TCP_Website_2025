import { Test, TestingModule } from '@nestjs/testing';
import { RecruitmentSettingsJob } from './recruitment-settings.job';
import { RecruitmentSettingsService } from '../recruitment/recruitment-settings.service';

describe('RecruitmentSettingsJob', () => {
    let job: RecruitmentSettingsJob;
    let settingsService: jest.Mocked<RecruitmentSettingsService>;

    beforeEach(async () => {
        const mockSettingsService = {
            checkAndUpdateAutomation: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecruitmentSettingsJob,
                {
                    provide: RecruitmentSettingsService,
                    useValue: mockSettingsService,
                },
            ],
        }).compile();

        job = module.get<RecruitmentSettingsJob>(RecruitmentSettingsJob);
        settingsService = module.get(RecruitmentSettingsService);
    });

    describe('checkRecruitmentAutomation', () => {
        it('should call settingsService.checkAndUpdateAutomation', async () => {
            settingsService.checkAndUpdateAutomation.mockResolvedValue();

            await job.checkRecruitmentAutomation();

            expect(settingsService.checkAndUpdateAutomation).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            settingsService.checkAndUpdateAutomation.mockRejectedValue(
                new Error('Test error'),
            );

            // Should not throw
            await expect(job.checkRecruitmentAutomation()).resolves.not.toThrow();
        });
    });
});
