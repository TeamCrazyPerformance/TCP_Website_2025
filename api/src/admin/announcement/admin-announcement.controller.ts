import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminAnnouncementService } from './admin-announcement.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';

@Controller('api/v1/admin/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAnnouncementController {
    constructor(private readonly adminAnnouncementService: AdminAnnouncementService) {}
    
    // 어드민용: 예약 포함 모든 공지사항 목록 조회
    @Get()
    getAllAnnouncements() {
        return this.adminAnnouncementService.findAll();
    }

    // 어드민용: 예약 포함 공지사항 상세 조회
    @Get(':id')
    getAnnouncementById(@Param('id', ParseIntPipe) id: number){
        return this.adminAnnouncementService.findOne(id);
    }
}
