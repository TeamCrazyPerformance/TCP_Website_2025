import {
    Controller,
    Get,
    Patch,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { RecruitmentSettingsService } from './recruitment-settings.service';
import { UpdateRecruitmentSettingsDto } from './dto/update-recruitment-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../members/entities/enums/user-role.enum';

@Controller('api/v1')
export class RecruitmentSettingsController {
    constructor(
        private readonly settingsService: RecruitmentSettingsService,
    ) { }

    // ===== Admin Endpoints =====

    /**
     * 현재 모집 설정 조회 (관리자용)
     */
    @Get('admin/recruitment/settings')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    getSettings() {
        return this.settingsService.getSettings();
    }

    /**
     * 모집 설정 변경
     */
    @Patch('admin/recruitment/settings')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    updateSettings(@Body() dto: UpdateRecruitmentSettingsDto) {
        return this.settingsService.updateSettings(dto);
    }

    /**
     * 즉시 모집 시작
     */
    @Post('admin/recruitment/start-now')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    startNow() {
        return this.settingsService.startNow();
    }

    /**
     * 즉시 모집 중단
     */
    @Post('admin/recruitment/stop-now')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    stopNow() {
        return this.settingsService.stopNow();
    }

    // ===== Public Endpoint =====

    /**
     * 현재 모집 상태 조회 (프론트엔드용, 인증 불필요)
     */
    @Get('recruitment/status')
    getPublicStatus() {
        return this.settingsService.getPublicStatus();
    }
}
