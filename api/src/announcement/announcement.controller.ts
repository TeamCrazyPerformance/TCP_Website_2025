import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Req,
  HttpCode 
} from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../members/entities/enums/user-role.enum';

@Controller('api/v1/announcements')
export class AnnouncementController {
    constructor(private readonly announcementService: AnnouncementService) {}
    
    // 게시일이 지난 모든 공지사항 목록 조회
    @Get()
    getAllAnnouncements() {
        return this.announcementService.findAll();
    }

    // 공지사항 상세 조회
    @Get(':id')
    getAnnouncementById(@Param('id', ParseIntPipe) id: number){
        return this.announcementService.findOne(id);
    }

    // 공지사항 작성(관리자 권한)
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    createAnnouncement(
        @Body() createDto: CreateAnnouncementDto,
        @Req() req: any, // Passport-JWT에서 유저 정보가 담긴다
    ) {
        const userId = req.user.id;
        return this.announcementService.create(createDto, userId);
    }

    // 공지사항 수정(관리자 권한)
    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    updateAnnouncement(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateDto: UpdateAnnouncementDto,
    ) {
        return this.announcementService.update(id, updateDto);
    }

    // 공지사항 삭제(관리자)
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @HttpCode(204)
    deleteAnnouncement(@Param('id', ParseIntPipe) id: number) {
        return this.announcementService.remove(id);
    }
}
