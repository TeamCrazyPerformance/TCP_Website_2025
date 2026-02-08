import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAnnouncementController } from './admin-announcement.controller';
import { AdminAnnouncementService } from './admin-announcement.service';
import { Announcement } from '../../announcement/entities/announcement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement])],
  controllers: [AdminAnnouncementController],
  providers: [AdminAnnouncementService],
})
export class AdminAnnouncementModule {}
