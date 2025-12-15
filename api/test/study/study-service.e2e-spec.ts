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
import { Role } from '../../src/study/entities/role.entity';
import { Progress } from '../../src/study/entities/progress.entity';
import { Resource } from '../../src/study/entities/resource.entity';

describe('StudyService', () => {
  let service: StudyService;
  let studyRepository: jest.Mocked<Repository<Study>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyService,
        {
          provide: getRepositoryToken(Study),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Progress),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Resource),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<StudyService>(StudyService);
    studyRepository = module.get(getRepositoryToken(Study));
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return empty array when no studies exist', async () => {
      studyRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      studyRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should throw BadRequestException for non-existent leader', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      const createStudyDto = {
        study_name: 'Test Study',
        start_year: 2025,
        study_description: 'Test Description',
        leader_id: 999,
      };

      await expect(service.create(createStudyDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should delete study successfully', async () => {
      studyRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.delete(1);

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException for non-existent study', async () => {
      studyRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    it('should throw NotFoundException for non-existent study', async () => {
      studyRepository.findOneBy.mockResolvedValue(null);

      await expect(service.addMember(999, 1, 'member')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      const mockStudy = { id: 1, study_name: 'Test' } as Study;
      studyRepository.findOneBy.mockResolvedValue(mockStudy);
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(service.addMember(1, 999, 'member')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException for existing member', async () => {
      const mockStudy = { id: 1, study_name: 'Test' } as Study;
      const mockUser = { id: 1, name: 'Test User' } as User;
      const mockRole = { id: 'uuid', role_name: 'Member' } as Role;

      studyRepository.findOneBy.mockResolvedValue(mockStudy);
      userRepository.findOneBy.mockResolvedValue(mockUser);
      roleRepository.findOne.mockResolvedValue(mockRole);

      await expect(service.addMember(1, 1, 'member')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
