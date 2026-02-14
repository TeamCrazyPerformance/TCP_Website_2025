import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
    // publishAt 날짜 유효성 검증
    let publishDate: Date;
    if (createDto.publishAt) {
      publishDate = new Date(createDto.publishAt);
      if (isNaN(publishDate.getTime())) {
        throw new BadRequestException('Invalid date format for publishAt');
      }
    } else {
      publishDate = new Date();
    }

    const announcement = this.announcementRepository.create({
      ...createDto,
      publishAt: publishDate,
      author: { id: userId }, 
    });
    return this.announcementRepository.save(announcement);
  }

  // 공지사항 수정
  async update(id: number, updateDto: UpdateAnnouncementDto): Promise<Announcement> {
    const updateData: any = { ...updateDto };

    if (updateDto.publishAt) {
      const publishDate = new Date(updateDto.publishAt);
      if (isNaN(publishDate.getTime())) {
        throw new BadRequestException('Invalid date format for publishAt');
      }
      updateData.publishAt = publishDate;
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
