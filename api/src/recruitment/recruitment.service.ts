import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateRecruitmentDto } from './dto/create-recruitment.dto';
import { UpdateRecruitmentDto } from './dto/update-recruitment.dto';
import { Resume } from './entities/resume.entity';
import { Award } from './entities/award.entity';
import { Project } from './entities/project.entity';
import { RecruitmentSettingsService } from './recruitment-settings.service';

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
    private readonly dataSource: DataSource,
    private readonly settingsService: RecruitmentSettingsService,
  ) { }

  async getRecruitmentStatus() {
    return this.settingsService.getPublicStatus();
  }

  async create(createRecruitmentDto: CreateRecruitmentDto) {
    // Check if recruitment is active
    const settings = await this.settingsService.getOrCreateSettings();
    if (!settings.is_application_enabled) {
      throw new ForbiddenException('현재 지원 기간이 아니거나 접수가 마감되었습니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('New application submitted');

      // Resume 엔티티 생성
      const resume = queryRunner.manager.create(Resume, {
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

      // Resume 저장
      const savedResume = await queryRunner.manager.save(Resume, resume);

      // Awards 저장 (선택사항)
      if (createRecruitmentDto.awards && createRecruitmentDto.awards.length > 0) {
        const awards = createRecruitmentDto.awards.map((awardDto) =>
          queryRunner.manager.create(Award, {
            ...awardDto,
            resume_id: savedResume.id,
          }),
        );
        await queryRunner.manager.save(Award, awards);
      }

      // Projects 저장 (선택사항)
      if (createRecruitmentDto.projects && createRecruitmentDto.projects.length > 0) {
        const projects = createRecruitmentDto.projects.map((projectDto) =>
          queryRunner.manager.create(Project, {
            ...projectDto,
            resume_id: savedResume.id,
          }),
        );
        await queryRunner.manager.save(Project, projects);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Application created with ID: ${savedResume.id}`);
      return { success: true, id: savedResume.id };
    } catch (error) {
      await queryRunner.rollbackTransaction();

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
    } finally {
      await queryRunner.release();
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
    // 기존 지원서 존재 여부 확인 (트랜잭션 시작 전)
    const existingResume = await this.resumeRepository.findOne({
      where: { id },
    });

    if (!existingResume) {
      throw new NotFoundException(`Recruitment with ID "${id}" not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Updating application #${id}`);

      // Resume 필드 업데이트
      Object.assign(existingResume, {
        name: updateRecruitmentDto.name ?? existingResume.name,
        student_number: updateRecruitmentDto.student_number ?? existingResume.student_number,
        major: updateRecruitmentDto.major ?? existingResume.major,
        phone_number: updateRecruitmentDto.phone_number ?? existingResume.phone_number,
        tech_stack: updateRecruitmentDto.tech_stack ?? existingResume.tech_stack,
        area_interest: updateRecruitmentDto.area_interest ?? existingResume.area_interest,
        self_introduction: updateRecruitmentDto.self_introduction ?? existingResume.self_introduction,
        club_expectation: updateRecruitmentDto.club_expectation ?? existingResume.club_expectation,
        submit_year: updateRecruitmentDto.submit_year ?? existingResume.submit_year,
        review_status: updateRecruitmentDto.review_status ?? existingResume.review_status,
        review_comment: updateRecruitmentDto.review_comment ?? existingResume.review_comment,
      });

      // review_status가 변경되면 reviewed_at 시간 업데이트
      if (updateRecruitmentDto.review_status && updateRecruitmentDto.review_status !== existingResume.review_status) {
        existingResume.reviewed_at = new Date();
      }

      await queryRunner.manager.save(Resume, existingResume);

      // Awards 업데이트 (제공된 경우 기존 것 삭제 후 재생성)
      if (updateRecruitmentDto.awards !== undefined) {
        await queryRunner.manager.delete(Award, { resume_id: id });
        if (updateRecruitmentDto.awards.length > 0) {
          const awards = updateRecruitmentDto.awards.map((awardDto) =>
            queryRunner.manager.create(Award, {
              ...awardDto,
              resume_id: id,
            }),
          );
          await queryRunner.manager.save(Award, awards);
        }
      }

      // Projects 업데이트 (제공된 경우 기존 것 삭제 후 재생성)
      if (updateRecruitmentDto.projects !== undefined) {
        await queryRunner.manager.delete(Project, { resume_id: id });
        if (updateRecruitmentDto.projects.length > 0) {
          const projects = updateRecruitmentDto.projects.map((projectDto) =>
            queryRunner.manager.create(Project, {
              ...projectDto,
              resume_id: id,
            }),
          );
          await queryRunner.manager.save(Project, projects);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Application #${id} updated successfully`);
      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update application #${id}`, error);
      throw new InternalServerErrorException(
        'An error occurred on the server.',
      );
    } finally {
      await queryRunner.release();
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
