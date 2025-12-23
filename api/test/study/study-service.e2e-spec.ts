import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { StudyService } from '../../src/study/study.service';
import { Study } from '../../src/study/entities/study.entity';
import { User } from '../../src/members/entities/user.entity';
import { StudyMember } from '../../src/study/entities/study-member.entity';
import { StudyMemberRole } from '../../src/study/entities/enums/study-member-role.enum';
import { Progress } from '../../src/study/entities/progress.entity';
import { Resource } from '../../src/study/entities/resource.entity';
import { CreateStudyDto } from '../../src/study/dto/request/create-study.dto';

describe('StudyService', () => {
  let service: StudyService;
  let studyRepository: jest.Mocked<Repository<Study>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let studyMemberRepository: jest.Mocked<Repository<StudyMember>>;
  let progressRepository: jest.Mocked<Repository<Progress>>;
  let resourceRepository: jest.Mocked<Repository<Resource>>;

  const mockStudyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockStudyMemberRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockProgressRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockResourceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyService,
        {
          provide: getRepositoryToken(Study),
          useValue: mockStudyRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(StudyMember),
          useValue: mockStudyMemberRepository,
        },
        {
          provide: getRepositoryToken(Progress),
          useValue: mockProgressRepository,
        },
        {
          provide: getRepositoryToken(Resource),
          useValue: mockResourceRepository,
        },
      ],
    }).compile();

    service = module.get<StudyService>(StudyService);
    studyRepository = module.get(getRepositoryToken(Study));
    userRepository = module.get(getRepositoryToken(User));
    studyMemberRepository = module.get(getRepositoryToken(StudyMember));
    progressRepository = module.get(getRepositoryToken(Progress));
    resourceRepository = module.get(getRepositoryToken(Resource));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return empty array when no studies exist', async () => {
      mockStudyRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should throw BadRequestException for non-existent leader', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      const createStudyDto: CreateStudyDto = {
        study_name: 'Test Study',
        start_year: 2025,
        study_description: 'Test Description',
        leader_id: 999,
        apply_deadline: '2025-12-31',
      };

      await expect(service.create(createStudyDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should delete study successfully', async () => {
      mockStudyRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.delete(1);

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.addMember(999, 1, StudyMemberRole.MEMBER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      const mockStudy = { id: 1, study_name: 'Test' } as Study;
      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.addMember(1, 999, StudyMemberRole.MEMBER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for existing member', async () => {
      const mockStudy = { id: 1, study_name: 'Test' } as Study;
      const mockUser = { id: 1, name: 'Test User' } as User;
      const mockStudyMember = { id: 1, role: StudyMemberRole.MEMBER } as StudyMember;

      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockStudyMemberRepository.findOne.mockResolvedValue(mockStudyMember);

      await expect(
        service.addMember(1, 1, StudyMemberRole.MEMBER),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('should throw NotFoundException for non-existent member', async () => {
      mockStudyMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.removeMember(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove member successfully', async () => {
      const mockStudyMember = { id: 1 } as StudyMember;
      mockStudyMemberRepository.findOne.mockResolvedValue(mockStudyMember);
      mockStudyMemberRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.removeMember(1, 1);

      expect(result).toEqual({ success: true });
    });
  });

  describe('applyToStudy', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOneBy.mockResolvedValue(null);

      await expect(service.applyToStudy(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException for already existing member', async () => {
      const mockStudy = { id: 1 } as Study;
      const mockUser = { id: 1 } as User;
      const mockStudyMember = { id: 1 } as StudyMember;

      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockStudyMemberRepository.findOne.mockResolvedValue(mockStudyMember);

      await expect(service.applyToStudy(1, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('approveMember', () => {
    it('should throw NotFoundException for non-existent member', async () => {
      mockStudyMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.approveMember(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for non-pending member', async () => {
      const mockStudyMember = { id: 1, role: StudyMemberRole.MEMBER } as StudyMember;
      mockStudyMemberRepository.findOne.mockResolvedValue(mockStudyMember);

      await expect(service.approveMember(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('leaveStudy', () => {
    it('should throw NotFoundException for non-member', async () => {
      mockStudyMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.leaveStudy(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for leader trying to leave', async () => {
      const mockStudyMember = { id: 1, role: StudyMemberRole.LEADER } as StudyMember;
      mockStudyMemberRepository.findOne.mockResolvedValue(mockStudyMember);

      await expect(service.leaveStudy(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow member to leave successfully', async () => {
      const mockStudyMember = { id: 1, role: StudyMemberRole.MEMBER } as StudyMember;
      mockStudyMemberRepository.findOne.mockResolvedValue(mockStudyMember);
      mockStudyMemberRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.leaveStudy(1, 1);

      expect(result).toEqual({ success: true });
    });
  });

  describe('deleteResource', () => {
    it('should soft delete resource successfully', async () => {
      const mockResource = {
        id: 1,
        name: 'test.pdf',
        dir_path: '/uploads/test.pdf',
        deleted_at: null,
      };
      mockResourceRepository.findOne.mockResolvedValue(mockResource);
      mockResourceRepository.save.mockResolvedValue({ ...mockResource, deleted_at: new Date() });

      const result = await service.deleteResource(1, 1);

      expect(result).toEqual({ success: true });
      expect(mockResourceRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent resource', async () => {
      mockResourceRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteResource(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteProgress', () => {
    it('should delete progress successfully', async () => {
      mockProgressRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.deleteProgress(1, 1);

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException for non-existent progress', async () => {
      mockProgressRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.deleteProgress(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStudy', () => {
    it('should throw BadRequestException for empty update', async () => {
      await expect(service.updateStudy(1, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateStudy(999, { study_name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update study successfully', async () => {
      const mockStudy = { id: 1, study_name: 'Test' } as Study;
      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockStudyRepository.save.mockResolvedValue(mockStudy);

      const result = await service.updateStudy(1, { study_name: 'Updated' });

      expect(result).toEqual({ success: true });
    });
  });

  describe('findMembersByStudyId', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOne.mockResolvedValue(null);

      await expect(service.findMembersByStudyId(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return members for existing study', async () => {
      const mockStudy = {
        id: 1,
        studyMembers: [
          {
            user: { id: 1, name: 'User 1' },
            role: StudyMemberRole.LEADER,
          },
          {
            user: { id: 2, name: 'User 2' },
            role: StudyMemberRole.MEMBER,
          },
        ],
      };
      mockStudyRepository.findOne.mockResolvedValue(mockStudy);

      const result = await service.findMembersByStudyId(1);

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toBe(1);
      expect(result[0].role).toBe(StudyMemberRole.LEADER);
    });
  });

  describe('findMemberDetailByStudyId', () => {
    it('should throw NotFoundException for non-existent member', async () => {
      mockStudyMemberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findMemberDetailByStudyId(1, 999),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return detailed member info', async () => {
      const mockMember = {
        user: {
          id: 1,
          name: 'Test User',
          student_number: '20210001',
          phone_number: '010-1234-5678',
          email: 'test@example.com',
          major: 'CS',
          profile_image: null,
        },
        role: StudyMemberRole.MEMBER,
      };
      mockStudyMemberRepository.findOne.mockResolvedValue(mockMember);

      const result = await service.findMemberDetailByStudyId(1, 1);

      expect(result.user_id).toBe(1);
      expect(result.name).toBe('Test User');
      expect(result.role).toBe(StudyMemberRole.MEMBER);
    });
  });

  describe('updateLeader', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOne.mockResolvedValue(null);

      await expect(service.updateLeader(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      const mockStudy = { id: 1, studyMembers: [] } as unknown as Study;
      mockStudyRepository.findOne.mockResolvedValue(mockStudy);
      mockUserRepository.findOneBy.mockResolvedValue(null);

      await expect(service.updateLeader(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findProgressByStudyId', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findProgressByStudyId(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return progress for existing study', async () => {
      const mockStudy = { id: 1 } as Study;
      const mockProgress = [
        { id: 1, title: 'Progress 1', content: 'Content 1' },
        { id: 2, title: 'Progress 2', content: 'Content 2' },
      ];
      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockProgressRepository.find.mockResolvedValue(mockProgress);

      const result = await service.findProgressByStudyId(1);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Progress 1');
    });
  });

  describe('createProgress', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createProgress(999, { title: 'Test', content: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create progress successfully', async () => {
      const mockStudy = { id: 1 } as Study;
      const mockProgress = { id: 1, title: 'Test', content: 'Test' };
      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockProgressRepository.create.mockReturnValue(mockProgress);
      mockProgressRepository.save.mockResolvedValue(mockProgress);

      const result = await service.createProgress(1, {
        title: 'Test',
        content: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
    });
  });

  describe('updateProgress', () => {
    it('should throw BadRequestException for empty update', async () => {
      await expect(service.updateProgress(1, 1, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for non-existent progress', async () => {
      mockProgressRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateProgress(1, 999, { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update progress successfully', async () => {
      const mockProgress = { id: 1, title: 'Original' };
      mockProgressRepository.findOneBy.mockResolvedValue(mockProgress);
      mockProgressRepository.save.mockResolvedValue(mockProgress);

      const result = await service.updateProgress(1, 1, { title: 'Updated' });

      expect(result).toEqual({ success: true });
    });
  });

  describe('findResourcesByStudyId', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findResourcesByStudyId(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return resources for existing study', async () => {
      const mockStudy = { id: 1 } as Study;
      const mockResources = [
        { id: 1, name: 'file.pdf', format: 'PDF', dir_path: '/uploads/file' },
      ];
      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockResourceRepository.find.mockResolvedValue(mockResources);

      const result = await service.findResourcesByStudyId(1);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('file.pdf');
    });
  });

  describe('uploadResource', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      mockStudyRepository.findOneBy.mockResolvedValue(null);

      const mockFile = {
        originalname: 'test.pdf',
        path: '/uploads/test.pdf',
      } as Express.Multer.File;

      await expect(service.uploadResource(999, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should upload resource successfully', async () => {
      const mockStudy = { id: 1 } as Study;
      const mockFile = {
        originalname: 'test.pdf',
        path: '/uploads/test.pdf',
      } as Express.Multer.File;
      const mockResource = {
        id: 1,
        name: 'test.pdf',
        format: 'PDF',
        dir_path: '/uploads/test.pdf',
      };

      mockStudyRepository.findOneBy.mockResolvedValue(mockStudy);
      mockResourceRepository.create.mockReturnValue(mockResource);
      mockResourceRepository.save.mockResolvedValue(mockResource);

      const result = await service.uploadResource(1, mockFile);

      expect(result.id).toBe(1);
      expect(result.name).toBe('test.pdf');
    });
  });

  describe('searchAvailableMembers', () => {
    it('should return matching users not in study', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 1, name: 'Test User', email: 'test@example.com' },
        ]),
      };
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchAvailableMembers(1, 'test');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test User');
    });
  });
});
