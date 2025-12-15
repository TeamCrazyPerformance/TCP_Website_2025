import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRecruitmentDto } from './dto/create-recruitment.dto';
import { UpdateRecruitmentDto } from './dto/update-recruitment.dto';
import { Resume } from './entities/resume.entity';
import { Award } from './entities/award.entity';
import { Project } from './entities/project.entity';

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);

  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    @InjectRepository(Award)
    private readonly awardRepository: Repository<Award>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(createRecruitmentDto: CreateRecruitmentDto) {
    try {
      this.logger.log('New application submitted');

      // Resume 엔티티 생성
      const resume = this.resumeRepository.create({
        name: createRecruitmentDto.name,
        student_number: createRecruitmentDto.student_number,
        major: createRecruitmentDto.major,
        phone_number: createRecruitmentDto.phone_number,
        tech_stack: createRecruitmentDto.tech_stack,
        area_interest: createRecruitmentDto.area_interest,
        self_introduction: createRecruitmentDto.self_introduction,
        club_expectation: createRecruitmentDto.club_expectation,
        submit_year: createRecruitmentDto.submit_year,
      });

      // Resume 저장 (cascade로 인해 awards, projects도 함께 저장됨)
      const savedResume = await this.resumeRepository.save(resume);

      // Awards 저장 (선택사항)
      if (createRecruitmentDto.awards && createRecruitmentDto.awards.length > 0) {
        const awards = createRecruitmentDto.awards.map((awardDto) =>
          this.awardRepository.create({
            ...awardDto,
            resume_id: savedResume.id,
          }),
        );
        await this.awardRepository.save(awards);
      }

      // Projects 저장 (선택사항)
      if (createRecruitmentDto.projects && createRecruitmentDto.projects.length > 0) {
        const projects = createRecruitmentDto.projects.map((projectDto) =>
          this.projectRepository.create({
            ...projectDto,
            resume_id: savedResume.id,
          }),
        );
        await this.projectRepository.save(projects);
      }

      this.logger.log(`Application created with ID: ${savedResume.id}`);
      return { success: true, id: savedResume.id };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to create application: ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'An error occurred while processing the application.',
        );
      }

      this.logger.error('An unknown error occurred', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred on the server.',
      );
    }
  }

  // 모든 지원서 목록을 반환 (관계 데이터 포함)
  async findAll() {
    try {
      this.logger.log('Fetching all recruitment applications');

      const resumes = await this.resumeRepository.find({
        relations: ['awards', 'projects'],
        order: {
          created_at: 'DESC',
        },
      });

      return resumes;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to fetch all applications: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          'An unknown error occurred while fetching all applications',
          error,
        );
      }
      throw new InternalServerErrorException(
        'An error occurred on the server.',
      );
    }
  }

  // ID로 특정 지원서를 찾아 반환 (관계 데이터 포함)
  async findOne(id: number) {
    try {
      this.logger.log(`Fetching application with id: ${id}`);

      const resume = await this.resumeRepository.findOne({
        where: { id },
        relations: ['awards', 'projects'],
      });

      if (!resume) {
        throw new NotFoundException(`Recruitment with ID "${id}" not found`);
      }

      return resume;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to find application #${id}`, error);
      throw new InternalServerErrorException(
        'An error occurred on the server.',
      );
    }
  }

  // 특정 지원서 수정
  async update(id: number, updateRecruitmentDto: UpdateRecruitmentDto) {
    try {
      this.logger.log(`Updating application #${id}`);

      // 기존 지원서 존재 여부 확인
      const resume = await this.resumeRepository.findOne({
        where: { id },
        relations: ['awards', 'projects'],
      });

      if (!resume) {
        throw new NotFoundException(`Recruitment with ID "${id}" not found`);
      }

      // Resume 필드 업데이트
      Object.assign(resume, {
        name: updateRecruitmentDto.name ?? resume.name,
        student_number: updateRecruitmentDto.student_number ?? resume.student_number,
        major: updateRecruitmentDto.major ?? resume.major,
        phone_number: updateRecruitmentDto.phone_number ?? resume.phone_number,
        tech_stack: updateRecruitmentDto.tech_stack ?? resume.tech_stack,
        area_interest: updateRecruitmentDto.area_interest ?? resume.area_interest,
        self_introduction: updateRecruitmentDto.self_introduction ?? resume.self_introduction,
        club_expectation: updateRecruitmentDto.club_expectation ?? resume.club_expectation,
        submit_year: updateRecruitmentDto.submit_year ?? resume.submit_year,
      });

      await this.resumeRepository.save(resume);

      // Awards 업데이트 (제공된 경우 기존 것 삭제 후 재생성)
      if (updateRecruitmentDto.awards !== undefined) {
        await this.awardRepository.delete({ resume_id: id });
        if (updateRecruitmentDto.awards.length > 0) {
          const awards = updateRecruitmentDto.awards.map((awardDto) =>
            this.awardRepository.create({
              ...awardDto,
              resume_id: id,
            }),
          );
          await this.awardRepository.save(awards);
        }
      }

      // Projects 업데이트 (제공된 경우 기존 것 삭제 후 재생성)
      if (updateRecruitmentDto.projects !== undefined) {
        await this.projectRepository.delete({ resume_id: id });
        if (updateRecruitmentDto.projects.length > 0) {
          const projects = updateRecruitmentDto.projects.map((projectDto) =>
            this.projectRepository.create({
              ...projectDto,
              resume_id: id,
            }),
          );
          await this.projectRepository.save(projects);
        }
      }

      this.logger.log(`Application #${id} updated successfully`);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update application #${id}`, error);
      throw new InternalServerErrorException(
        'An error occurred on the server.',
      );
    }
  }

  // ID로 특정 지원서를 삭제 (cascade로 인해 awards, projects도 함께 삭제됨)
  async remove(id: number) {
    try {
      this.logger.log(`Removing application #${id}`);

      const result = await this.resumeRepository.delete(id);

      if (result.affected === 0) {
        throw new NotFoundException(`Recruitment with ID "${id}" not found`);
      }

      this.logger.log(`Application #${id} removed successfully`);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to remove application #${id}`, error);
      throw new InternalServerErrorException(
        'An error occurred on the server.',
      );
    }
  }
}
