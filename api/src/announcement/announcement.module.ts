import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementController } from './announcement.controller';
import { AnnouncementService } from './announcement.service';
import { Announcement } from './entities/announcement.entity';
import { User } from '../members/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement, User])],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
})
export class AnnouncementModule {}
