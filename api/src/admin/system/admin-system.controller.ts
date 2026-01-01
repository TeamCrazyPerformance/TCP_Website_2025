import { Controller, Get, Post, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { AdminSystemService } from './admin-system.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';

@Controller('api/v1/admin/system')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSystemController {
    constructor(private readonly adminSystemService: AdminSystemService) { }

    @Get('stats')
    async getSystemStats() {
        return this.adminSystemService.getSystemStats();
    }

    @Post(':action')
    async controlServer(@Param('action') action: string) {
        if (action === 'restart') {
            return this.adminSystemService.restartServer();
        } else if (action === 'shutdown') {
            return this.adminSystemService.shutdownServer();
        } else {
            throw new BadRequestException('Invalid action. Use "restart" or "shutdown".');
        }
    }
}
