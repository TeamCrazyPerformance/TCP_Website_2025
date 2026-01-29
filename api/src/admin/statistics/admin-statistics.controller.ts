import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';
import { AdminStatisticsService, StatisticsData } from './admin-statistics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('/api/v1/admin/statistics')
export class AdminStatisticsController {
    constructor(private readonly service: AdminStatisticsService) { }

    @Get()
    getStatistics() {
        return this.service.getStatistics();
    }

    @Post()
    async saveStatistics(@Body() stats: Partial<StatisticsData>) {
        this.service.saveStatistics(stats);
        return { message: 'Statistics saved successfully' };
    }

    @Get('export')
    async exportStatistics() {
        return this.service.getStatistics();
    }
}
