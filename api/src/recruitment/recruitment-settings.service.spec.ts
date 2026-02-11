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
        start_date: null,
        end_date: null,
        is_application_enabled: false,
        auto_enable_on_start: false,
        auto_disable_on_end: false,
        updated_at: new Date(),
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
                is_application_enabled: true,
                auto_enable_on_start: true,
            };
            repository.findOne.mockResolvedValue(mockSettings);
            repository.save.mockResolvedValue(updatedSettings);

            const result = await service.updateSettings({
                is_application_enabled: true,
                auto_enable_on_start: true,
            });

            expect(result.is_application_enabled).toBe(true);
            expect(result.auto_enable_on_start).toBe(true);
        });

        it('should update start_date and end_date', async () => {
            const start_date = '2026-01-01T00:00:00Z';
            const end_date = '2026-01-31T23:59:59Z';
            const updatedSettings = {
                ...mockSettings,
                start_date: new Date(start_date),
                end_date: new Date(end_date),
            };
            repository.findOne.mockResolvedValue(mockSettings);
            repository.save.mockResolvedValue(updatedSettings);

            const result = await service.updateSettings({ start_date, end_date });

            expect(result.start_date).toEqual(new Date(start_date));
            expect(result.end_date).toEqual(new Date(end_date));
        });
    });

    describe('startNow', () => {
        it('should enable application immediately', async () => {
            repository.findOne.mockResolvedValue(mockSettings);
            repository.save.mockResolvedValue({ ...mockSettings, is_application_enabled: true });

            const result = await service.startNow();

            expect(result.success).toBe(true);
            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ is_application_enabled: true }),
            );
        });
    });

    describe('stopNow', () => {
        it('should disable application immediately', async () => {
            const enabledSettings = { ...mockSettings, is_application_enabled: true };
            repository.findOne.mockResolvedValue(enabledSettings);
            repository.save.mockResolvedValue({ ...enabledSettings, is_application_enabled: false });

            const result = await service.stopNow();

            expect(result.success).toBe(true);
            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ is_application_enabled: false }),
            );
        });
    });

    describe('getPublicStatus', () => {
        it('should return public status', async () => {
            repository.findOne.mockResolvedValue(mockSettings);

            const result = await service.getPublicStatus();

            expect(result).toEqual({
                is_application_enabled: mockSettings.is_application_enabled,
                start_date: mockSettings.start_date,
                end_date: mockSettings.end_date,
            });
        });
    });

    describe('checkAndUpdateAutomation', () => {
        it('should auto-enable when start date is reached', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const settingsWithAutoEnable = {
                ...mockSettings,
                auto_enable_on_start: true,
                start_date: pastDate,
                is_application_enabled: false,
            };
            repository.findOne.mockResolvedValue(settingsWithAutoEnable);
            repository.save.mockResolvedValue({ ...settingsWithAutoEnable, is_application_enabled: true });

            await service.checkAndUpdateAutomation();

            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ is_application_enabled: true }),
            );
        });

        it('should auto-disable when end date is passed', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const settingsWithAutoDisable = {
                ...mockSettings,
                auto_disable_on_end: true,
                end_date: pastDate,
                is_application_enabled: true,
            };
            repository.findOne.mockResolvedValue(settingsWithAutoDisable);
            repository.save.mockResolvedValue({ ...settingsWithAutoDisable, is_application_enabled: false });

            await service.checkAndUpdateAutomation();

            expect(repository.save).toHaveBeenCalledWith(
                expect.objectContaining({ is_application_enabled: false }),
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
                auto_enable_on_start: true,
                start_date: futureDate,
                is_application_enabled: false,
            };
            repository.findOne.mockResolvedValue(settingsWithFutureStart);

            await service.checkAndUpdateAutomation();

            expect(repository.save).not.toHaveBeenCalled();
        });
    });
});
