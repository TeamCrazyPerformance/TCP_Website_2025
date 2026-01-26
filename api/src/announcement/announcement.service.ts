import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
  ) { }

  // 게시일이 지난 모든 공지사항 목록 조회
  async findAll(): Promise<Announcement[]> {
    return this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoin('announcement.author', 'author')
      .addSelect(['author.name']) 
      .where('announcement.publishAt <= :now', { now: new Date() })
      .orderBy('announcement.publishAt', 'DESC')
      .getMany();
  }

  // 공지사항 상세 조회
  async findOne(id: number): Promise<Announcement> {
    const announcement = await this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoin('announcement.author', 'author')
      .addSelect(['author.name']) 
      .where('announcement.id = :id', { id })
      .andWhere('announcement.publishAt <= :now', { now: new Date() })
      .getOne();

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    await this.announcementRepository.increment({ id }, 'views', 1);
    announcement.views += 1;
    return announcement;
  }

  // 공지사항 생성
  async create(createDto: CreateAnnouncementDto, userId: string): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      ...createDto,
      publishAt: createDto.publishAt ? new Date(createDto.publishAt) : new Date(), // publishAt이 지정되지 않으면 현재 시각으로 자동 설정
      author: { id: userId }, 
    });
    return this.announcementRepository.save(announcement);
  }

  // 공지사항 수정
  async update(id: number, updateDto: UpdateAnnouncementDto): Promise<Announcement> {
    const updateData: any = { ...updateDto };

    if (updateDto.publishAt) {
      updateData.publishAt = new Date(updateDto.publishAt);
    }

    await this.announcementRepository.update(id, updateData);

    const updated = await this.announcementRepository.findOneBy({ id });
    if (!updated) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }
    return updated;
  }

  // 공지사항 삭제
  async remove(id: number): Promise<void> {
    const result = await this.announcementRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }
  }
}
