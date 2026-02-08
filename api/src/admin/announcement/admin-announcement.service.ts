import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../../announcement/entities/announcement.entity';

@Injectable()
export class AdminAnnouncementService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
  ) { }

  // 어드민용: 예약 포함 모든 공지사항 조회
  async findAll(): Promise<Announcement[]> {
    return this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoin('announcement.author', 'author')
      .addSelect(['author.name']) 
      .orderBy('announcement.publishAt', 'DESC')
      .getMany();
  }

  // 어드민용: 예약 포함 공지사항 상세 조회
  async findOne(id: number): Promise<Announcement> {
    const announcement = await this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoin('announcement.author', 'author')
      .addSelect(['author.name']) 
      .where('announcement.id = :id', { id })
      .getOne();

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return announcement;
  }
}
