import { Test, TestingModule } from '@nestjs/testing';
import { StudyController } from '../../src/study/study.controller';
import { StudyService } from '../../src/study/study.service';
import { CreateStudyDto } from '../../src/study/dto/request/create-study.dto';
import { UpdateStudyLeaderDto } from '../../src/study/dto/request/update-study-leader.dto';
import { AddStudyMemberDto } from '../../src/study/dto/request/add-study-member.dto';
import { CreateProgressDto } from '../../src/study/dto/request/create-progress.dto';
import { UpdateProgressDto } from '../../src/study/dto/request/update-progress.dto';
import { SearchAvailableMembersQueryDto } from '../../src/study/dto/request/search-available-members-query.dto';
import { GetStudiesQueryDto } from '../../src/study/dto/request/get-studies-query.dto';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

describe('StudyController', () => {
  let controller: StudyController;
  let reflector: Reflector;

  // Mock service methods
  const mockStudyService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMembersByStudyId: jest.fn(),
    updateLeader: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    findProgressByStudyId: jest.fn(),
    createProgress: jest.fn(),
    updateProgress: jest.fn(),
    deleteProgress: jest.fn(),
    findResourcesByStudyId: jest.fn(),
    uploadResource: jest.fn(),
    deleteResource: jest.fn(),
    searchAvailableMembers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudyController],
      providers: [
        {
          provide: StudyService,
          useValue: mockStudyService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<StudyController>(StudyController);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all studies', async () => {
      const mockStudies = [
        {
          id: 1,
          study_name: 'Test Study',
          start_year: 2025,
          study_description: 'Test Description',
          leader_name: 'Test Leader',
          members_count: 3,
        },
      ];
      const query: GetStudiesQueryDto = {};
      mockStudyService.findAll.mockResolvedValue(mockStudies);

      const result = await controller.findAll(query);

      expect(mockStudyService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockStudies);
    });

    it('should return studies filtered by year', async () => {
      const query: GetStudiesQueryDto = { year: 2025 };
      const mockStudies = [];
      mockStudyService.findAll.mockResolvedValue(mockStudies);

      const result = await controller.findAll(query);

      expect(mockStudyService.findAll).toHaveBeenCalledWith(2025);
      expect(result).toEqual(mockStudies);
    });

    it('should not have AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.findAll);
      expect(guards).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return study details', async () => {
      const mockStudyDetail = {
        id: 1,
        study_name: 'Test Study',
        start_year: 2025,
        study_description: 'Test Description',
        leader: { user_id: 1, name: 'Leader', role_name: 'Leader' },
        members: [],
        resources: [],
        progress: [],
      };
      mockStudyService.findById.mockResolvedValue(mockStudyDetail);

      const result = await controller.findById(1);

      expect(mockStudyService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockStudyDetail);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.findById);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('create', () => {
    it('should create a new study', async () => {
      const createStudyDto: CreateStudyDto = {
        study_name: 'New Study',
        start_year: 2025,
        study_description: 'New Description',
        leader_id: 1,
      };
      const mockResponse = { success: true, id: 1 };
      mockStudyService.create.mockResolvedValue(mockResponse);

      const result = await controller.create(createStudyDto);

      expect(mockStudyService.create).toHaveBeenCalledWith(createStudyDto);
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.create);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('delete', () => {
    it('should delete a study', async () => {
      const mockResponse = { success: true };
      mockStudyService.delete.mockResolvedValue(mockResponse);

      const result = await controller.delete(1);

      expect(mockStudyService.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.delete);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('findMembers', () => {
    it('should return study members', async () => {
      const mockMembers = [
        { user_id: 1, name: 'Leader', role_name: 'Leader' },
        { user_id: 2, name: 'Member', role_name: 'Member' },
      ];
      mockStudyService.findMembersByStudyId.mockResolvedValue(mockMembers);

      const result = await controller.findMembers(1);

      expect(mockStudyService.findMembersByStudyId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockMembers);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.findMembers);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('updateLeader', () => {
    it('should update study leader', async () => {
      const updateDto: UpdateStudyLeaderDto = { user_id: 2 };
      const mockResponse = { success: true };
      mockStudyService.updateLeader.mockResolvedValue(mockResponse);

      const result = await controller.updateLeader(1, updateDto);

      expect(mockStudyService.updateLeader).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.updateLeader);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('addMember', () => {
    it('should add a member to study', async () => {
      const addMemberDto: AddStudyMemberDto = {
        user_id: 3,
        role_name: 'Member',
      };
      const mockResponse = { success: true };
      mockStudyService.addMember.mockResolvedValue(mockResponse);

      const result = await controller.addMember(1, addMemberDto);

      expect(mockStudyService.addMember).toHaveBeenCalledWith(1, 3, 'Member');
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.addMember);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('removeMember', () => {
    it('should remove a member from study', async () => {
      const mockResponse = { success: true };
      mockStudyService.removeMember.mockResolvedValue(mockResponse);

      const result = await controller.removeMember(1, 2);

      expect(mockStudyService.removeMember).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.removeMember);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('findProgressByStudyId', () => {
    it('should return study progress', async () => {
      const mockProgress = [
        { id: 1, title: 'Progress 1', content: 'Content 1' },
        { id: 2, title: 'Progress 2', content: 'Content 2' },
      ];
      mockStudyService.findProgressByStudyId.mockResolvedValue(mockProgress);

      const result = await controller.findProgressByStudyId(1);

      expect(mockStudyService.findProgressByStudyId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProgress);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.findProgressByStudyId);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('createProgress', () => {
    it('should create a new progress entry', async () => {
      const createProgressDto: CreateProgressDto = {
        title: 'New Progress',
        content: 'New Content',
      };
      const mockResponse = { success: true, id: 1 };
      mockStudyService.createProgress.mockResolvedValue(mockResponse);

      const result = await controller.createProgress(1, createProgressDto);

      expect(mockStudyService.createProgress).toHaveBeenCalledWith(
        1,
        createProgressDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.createProgress);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('updateProgress', () => {
    it('should update a progress entry', async () => {
      const updateProgressDto: UpdateProgressDto = {
        title: 'Updated Progress',
      };
      const mockResponse = { success: true };
      mockStudyService.updateProgress.mockResolvedValue(mockResponse);

      const result = await controller.updateProgress(1, 1, updateProgressDto);

      expect(mockStudyService.updateProgress).toHaveBeenCalledWith(
        1,
        1,
        updateProgressDto,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.updateProgress);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('deleteProgress', () => {
    it('should delete a progress entry', async () => {
      const mockResponse = { success: true };
      mockStudyService.deleteProgress.mockResolvedValue(mockResponse);

      const result = await controller.deleteProgress(1, 1);

      expect(mockStudyService.deleteProgress).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.deleteProgress);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('findResourcesByStudyId', () => {
    it('should return study resources', async () => {
      const mockResources = [
        {
          id: 1,
          name: 'test.pdf',
          format: 'PDF',
          dir_path: '/uploads/test.pdf',
        },
      ];
      mockStudyService.findResourcesByStudyId.mockResolvedValue(mockResources);

      const result = await controller.findResourcesByStudyId(1);

      expect(mockStudyService.findResourcesByStudyId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResources);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.findResourcesByStudyId);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('uploadResource', () => {
    it('should upload a resource file', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        path: '/uploads/test.pdf',
      } as Express.Multer.File;

      const mockResponse = {
        id: 1,
        name: 'test.pdf',
        format: 'PDF',
        dir_path: '/uploads/test.pdf',
      };
      mockStudyService.uploadResource.mockResolvedValue(mockResponse);

      const result = await controller.uploadResource(1, mockFile);

      expect(mockStudyService.uploadResource).toHaveBeenCalledWith(1, mockFile);
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.uploadResource);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('deleteResource', () => {
    it('should delete a resource', async () => {
      const mockResponse = { success: true };
      mockStudyService.deleteResource.mockResolvedValue(mockResponse);

      const result = await controller.deleteResource(1, 1);

      expect(mockStudyService.deleteResource).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(mockResponse);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.deleteResource);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });

  describe('searchAvailableMembers', () => {
    it('should search for available members', async () => {
      const query: SearchAvailableMembersQueryDto = { search: 'test' };
      const mockUsers = [
        {
          user_id: 1,
          name: 'Test User',
          email: 'test@example.com',
        },
      ];
      mockStudyService.searchAvailableMembers.mockResolvedValue(mockUsers);

      const result = await controller.searchAvailableMembers(1, query);

      expect(mockStudyService.searchAvailableMembers).toHaveBeenCalledWith(
        1,
        'test',
      );
      expect(result).toEqual(mockUsers);
    });

    it('should have JWT AuthGuard applied', () => {
      const guards = reflector.get('__guards__', controller.searchAvailableMembers);
      expect(guards).toBeDefined();
      expect(guards).toContain(AuthGuard('jwt'));
    });
  });
});
