import { Module } from '@nestjs/common';
import { MainPageController } from './main-page.controller';
import { AdminStatisticsModule } from '../admin/statistics/admin-statistics.module';
import { ActivityImagesModule } from '../admin/activity-images/activity-images.module';

@Module({
    imports: [AdminStatisticsModule, ActivityImagesModule],
    controllers: [MainPageController],
})
export class MainPageModule { }
