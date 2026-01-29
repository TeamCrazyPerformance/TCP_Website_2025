import { Controller, Get, Post, Param, UseGuards, BadRequestException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AdminSystemService } from './admin-system.service';
import { ActivityImagesService } from '../activity-images/activity-images.service';
import { AdminStatisticsService } from '../statistics/admin-statistics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';

@Controller('api/v1/admin/system')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSystemController {
    constructor(
        private readonly adminSystemService: AdminSystemService,
        private readonly activityImagesService: ActivityImagesService,
        private readonly adminStatisticsService: AdminStatisticsService
    ) { }

    @Get('stats')
    async getSystemStats() {
        return this.adminSystemService.getSystemStats();
    }

    @Get('dashboard')
    async getDashboardStats() {
        return this.adminSystemService.getDashboardStats();
    }

    @Post('settings/import')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'statistics', maxCount: 1 },
        { name: 'tags', maxCount: 1 },
    ]))
    async importSettings(@UploadedFiles() files: { statistics?: Express.Multer.File[], tags?: Express.Multer.File[] }) {
        if (!files || !files.statistics || !files.tags) {
            throw new BadRequestException('Both statistic.json (statistics) and photos.json (tags) files are required.');
        }

        try {
            // Parse & Validate Stats
            const statsContent = JSON.parse(files.statistics[0].buffer.toString('utf8'));
            if (!this.adminStatisticsService.validateStats(statsContent)) {
                throw new BadRequestException('Invalid format: statistic.json');
            }

            // Parse & Validate Tags
            const tagsContent = JSON.parse(files.tags[0].buffer.toString('utf8'));
            if (!this.activityImagesService.validateTags(tagsContent)) {
                throw new BadRequestException('Invalid format: photos.json');
            }

            // Save
            this.adminStatisticsService.saveStatistics(statsContent);
            this.activityImagesService.saveTags(tagsContent);

            return { message: 'Settings imported successfully.' };
        } catch (e) {
            if (e instanceof BadRequestException) throw e;
            throw new BadRequestException('Failed to process files: ' + e.message);
        }
    }

    @Post(':action')
    async controlServer(@Param('action') action: string) {
        if (action === 'restart') {
            return this.adminSystemService.restartServer();
        } else if (action === 'shutdown') {
            return this.adminSystemService.shutdownServer();
        } else {
            // If action accidentally catches 'settings', explicitly ignore or fallback.
            if (action === 'settings') return;
            throw new BadRequestException('Invalid action. Use "restart" or "shutdown".');
        }
    }
}
