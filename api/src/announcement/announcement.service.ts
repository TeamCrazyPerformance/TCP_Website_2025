import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual  } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementService {
    constructor(
      @InjectRepository(Announcement)
      private readonly announcementRepository: Repository<Announcement>,
    ) {}

    // 게시일이 지난 모든 공지사항 목록 조회
    async findAll(): Promise<Announcement[]> {
      return this.announcementRepository.find({
        where: { publishAt: LessThanOrEqual(new Date())},
        order: { publishAt: 'DESC' }, // 최신순
        relations: ['author'], // 작성자 정보 포함
      });
    }

    // 공지사항 상세 조회
    async findOne(id: number): Promise<Announcement> {
      const announcement = await this.announcementRepository.findOne({
        where: { id, publishAt: LessThanOrEqual(new Date()) },
        relations: ['author'], // 작성자 정보 포함
      });

      if (!announcement) {
        throw new NotFoundException(`Announcement with ID ${id} not found`);
      } 

      await this.announcementRepository.increment({ id }, 'views', 1);
      return announcement;
    }

    // 공지사항 생성
    async create(createDto: CreateAnnouncementDto, userId: number): Promise<Announcement> {
      const announcement = this.announcementRepository.create({
        ...createDto,
        publishAt: createDto.publishAt ? new Date(createDto.publishAt) : new Date(), // ublishAt이 지정되지 않으면 현재 시각으로 자동 설정
        author: { id: userId }, // 작성자 연결
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
