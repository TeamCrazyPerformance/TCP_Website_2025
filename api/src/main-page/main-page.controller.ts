import { Controller, Get } from '@nestjs/common';
import { AdminStatisticsService } from '../admin/statistics/admin-statistics.service';
import { ActivityImagesService } from '../admin/activity-images/activity-images.service';

@Controller('api/v1/main')
export class MainPageController {
    constructor(
        private readonly statisticsService: AdminStatisticsService,
        private readonly activityImagesService: ActivityImagesService,
    ) { }

    @Get('statistics')
    getStatistics() {
        return this.statisticsService.getStatistics();
    }

    @Get('activity-images')
    getActivityImages() {
        return this.activityImagesService.getAll();
    }
}
