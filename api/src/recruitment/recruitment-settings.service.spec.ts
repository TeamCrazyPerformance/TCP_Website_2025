import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecruitmentSettingsService } from './recruitment-settings.service';
import { RecruitmentSettings } from './entities/recruitment-settings.entity';

describe('RecruitmentSettingsService', () => {
    let service: RecruitmentSettingsService;
    let repository: jest.Mocked<Repository<RecruitmentSettings>>;

    const mockSettings: RecruitmentSettings = {
        id: 1,
        startDate: null,
        endDate: null,
        isApplicationEnabled: false,
        autoEnableOnStart: false,
        autoDisableOnEnd: false,
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecruitmentSettingsService,
                {
                    provide: getRepositoryToken(RecruitmentSettings),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<RecruitmentSettingsService>(RecruitmentSettingsService);
        repository = module.get(getRepositoryToken(RecruitmentSettings));
    });

    describe('getOrCreateSettings', () => {
        it('should return existing settings', async () => {
            repository.findOne.mockResolvedValue(mockSettings);

            const result = await service.getOrCreateSettings();

            expect(result).toEqual(mockSettings);
            expect(repository.findOne).toHaveBeenCalledWith({ where: {} });
        });

        it('should create default settings if none exist', async () => {
            repository.findOne.mockResolvedValue(null);
            repository.create.mockReturnValue(mockSettings);
            repository.save.mockResolvedValue(mockSettings);

            const result = await service.getOrCreateSettings();

            expect(result).toEqual(mockSettings);
            expect(repository.create).toHaveBeenCalled();
            expect(repository.save).toHaveBeenCalled();
        });
    });

    describe('updateSettings', () => {
        it('should update settings with provided values', async () => {
            const updatedSettings = {
                ...mockSettings,
                isApplicationEnabled: true,
                autoEnableOnStart: true,
            };
            repository.findOne.mockResolvedValue(mockSettings);
            repository.save.mockResolvedValue(updatedSettings);

            const result = await service.updateSettings({
                isApplicationEnabled: true,
                autoEnableOnStart: true,
            });

            expect(result.isApplicationEnabled).toBe(true);
            expect(result.autoEnableOnStart).toBe(true);
        });

        it('should update startDate and endDate', async () => {
            const startDate = '2026-01-01T00:00:00Z';
            const endDate = '2026-01-31T23:59:59Z';
            const updatedSettings = {
                ...mockSettings,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            };
            repository.findOne.mockResolvedValue(mockSettings);
            repository.save.mockResolvedValue(updatedSettings);

            const result = await service.updateSettings({ startDate, endDate });

            expect(result.startDate).toEqual(new Date(startDate));
            expect(result.endDate).toEqual(new Date(endDate));
        });
    });

    describe('startNow', () => {
        it('should enable application immediately', async () => {
            repository.findOne.mockResolvedValue(mockSettings);
            repository.save.mockResolvedValue({ ...mockSettings, isApplicationEnabled: true });

            const result = await service.startNow();

            expect(result.success).toBe(true);
            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ isApplicationEnabled: true }),
            );
        });
    });

    describe('stopNow', () => {
        it('should disable application immediately', async () => {
            const enabledSettings = { ...mockSettings, isApplicationEnabled: true };
            repository.findOne.mockResolvedValue(enabledSettings);
            repository.save.mockResolvedValue({ ...enabledSettings, isApplicationEnabled: false });

            const result = await service.stopNow();

            expect(result.success).toBe(true);
            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ isApplicationEnabled: false }),
            );
        });
    });

    describe('getPublicStatus', () => {
        it('should return public status', async () => {
            repository.findOne.mockResolvedValue(mockSettings);

            const result = await service.getPublicStatus();

            expect(result).toEqual({
                isApplicationEnabled: mockSettings.isApplicationEnabled,
                startDate: mockSettings.startDate,
                endDate: mockSettings.endDate,
            });
        });
    });

    describe('checkAndUpdateAutomation', () => {
        it('should auto-enable when start date is reached', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const settingsWithAutoEnable = {
                ...mockSettings,
                autoEnableOnStart: true,
                startDate: pastDate,
                isApplicationEnabled: false,
            };
            repository.findOne.mockResolvedValue(settingsWithAutoEnable);
            repository.save.mockResolvedValue({ ...settingsWithAutoEnable, isApplicationEnabled: true });

            await service.checkAndUpdateAutomation();

            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ isApplicationEnabled: true }),
            );
        });

        it('should auto-disable when end date is passed', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const settingsWithAutoDisable = {
                ...mockSettings,
                autoDisableOnEnd: true,
                endDate: pastDate,
                isApplicationEnabled: true,
            };
            repository.findOne.mockResolvedValue(settingsWithAutoDisable);
            repository.save.mockResolvedValue({ ...settingsWithAutoDisable, isApplicationEnabled: false });

            await service.checkAndUpdateAutomation();

            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ isApplicationEnabled: false }),
            );
        });

        it('should not update if no settings exist', async () => {
            repository.findOne.mockResolvedValue(null);

            await service.checkAndUpdateAutomation();

            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should not update if conditions are not met', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);

            const settingsWithFutureStart = {
                ...mockSettings,
                autoEnableOnStart: true,
                startDate: futureDate,
                isApplicationEnabled: false,
            };
            repository.findOne.mockResolvedValue(settingsWithFutureStart);

            await service.checkAndUpdateAutomation();

            expect(repository.save).not.toHaveBeenCalled();
        });
    });
});
