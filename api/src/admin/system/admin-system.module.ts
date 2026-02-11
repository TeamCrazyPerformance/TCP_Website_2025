import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSystemController } from './admin-system.controller';
import { AdminSystemService } from './admin-system.service';
import { User } from '../../members/entities/user.entity';
import { Study } from '../../study/entities/study.entity';
import { ActivityImagesModule } from '../activity-images/activity-images.module';
import { AdminStatisticsModule } from '../statistics/admin-statistics.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Study]),
        ActivityImagesModule,
        AdminStatisticsModule
    ],
    controllers: [AdminSystemController],
    providers: [AdminSystemService],
})
export class AdminSystemModule { }

