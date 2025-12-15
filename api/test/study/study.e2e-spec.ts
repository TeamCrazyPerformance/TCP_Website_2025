/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';

import { StudyModule } from '../../src/study/study.module';
import { AuthModule } from '../../src/auth/auth.module';
import { Study } from '../../src/study/entities/study.entity';
import { User } from '../../src/members/entities/user.entity';
import { Role } from '../../src/study/entities/role.entity';
import { Progress } from '../../src/study/entities/progress.entity';
import { Resource } from '../../src/study/entities/resource.entity';

import { CreateStudyDto } from '../../src/study/dto/request/create-study.dto';
import { UpdateStudyLeaderDto } from '../../src/study/dto/request/update-study-leader.dto';
import { AddStudyMemberDto } from '../../src/study/dto/request/add-study-member.dto';
import { CreateProgressDto } from '../../src/study/dto/request/create-progress.dto';
import { UpdateProgressDto } from '../../src/study/dto/request/update-progress.dto';

// Type definitions for mock data
interface MockEntity {
  id: number | string;
  [key: string]: any;
}

interface FindOptions {
  where?: {
    id?: number | string;
    start_year?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

describe('Study Integration Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let validToken: string;

  // Mock data
  const mockUsers = [
    {
      id: 1,
      username: 'admin',
      name: 'Admin User',
      email: 'admin@example.com',
      student_number: '12345',
      roles: [],
    },
    {
      id: 2,
      username: 'leader',
      name: 'Leader User',
      email: 'leader@example.com',
      student_number: '67890',
      roles: [],
    },
    {
      id: 3,
      username: 'member',
      name: 'Member User',
      email: 'member@example.com',
      student_number: '11111',
      roles: [],
    },
  ];

  const mockStudies = [
    {
      id: 1,
      study_name: 'Mock Study 1',
      start_year: 2025,
      study_description: 'Test Study 1',
      roles: [
        {
          id: 'role-1',
          role_name: 'Leader',
          user_id: mockUsers[1], // Changed from 'user' to 'user_id'
          study: { id: 1 },
        },
        {
          id: 'role-2',
          role_name: 'member',
          user_id: mockUsers[2], // Changed from 'user' to 'user_id'
          study: { id: 1 },
        },
      ],
      progress: [
        {
          id: 1,
          title: 'Week 1',
          content: 'Introduction to the study',
          study: { id: 1 },
        },
      ],
      resources: [
        {
          id: 1,
          name: 'study-guide.pdf',
          format: 'PDF',
          dir_path: '/uploads/study-guide.pdf',
          study: { id: 1 },
        },
      ],
    },
    {
      id: 2,
      study_name: 'Mock Study 2',
      start_year: 2024,
      study_description: 'Test Study 2',
      roles: [],
      progress: [],
      resources: [],
    },
  ];

  const mockRoles = [
    {
      id: 'role-1',
      role_name: 'Leader',
      user_id: mockUsers[1], // Changed from 'user' to 'user_id'
      study: { id: 1 },
    },
    {
      id: 'role-2',
      role_name: 'member',
      user_id: mockUsers[2], // Changed from 'user' to 'user_id'
      study: { id: 1 },
    },
  ];

  const mockProgress = [
    {
      id: 1,
      title: 'Week 1',
      content: 'Introduction to the study',
      study: { id: 1 },
    },
  ];

  const mockResources = [
    {
      id: 1,
      name: 'study-guide.pdf',
      format: 'PDF',
      dir_path: '/uploads/study-guide.pdf',
      study: { id: 1 },
    },
  ];

  // Mock repository methods
  const createMockRepository = (data: MockEntity[]) => ({
    find: jest.fn().mockImplementation((options: FindOptions = {}) => {
      let result = [...data];
      if (options.where) {
        // Simple filtering logic for demonstration
        if (options.where.start_year) {
          result = result.filter(
            (item) => (item as any).start_year === options.where!.start_year,
          );
        }
        if (options.where.id) {
          result = result.filter((item) => item.id === options.where!.id);
        }
      }
      return Promise.resolve(result);
    }),
    findOne: jest.fn().mockImplementation((options: FindOptions) => {
      let item = data.find((d) => {
        if (options.where) {
          if (options.where.id) {
            return d.id === options.where.id;
          }
          // Handle nested where conditions for studies
          if (options.where.study && options.where.study.id) {
            return (d as any).study?.id === options.where.study.id;
          }
          // Handle role-specific queries with study_id and user_id
          if (options.where.study_id && options.where.user_id) {
            return (d as any).study?.id === options.where.study_id.id &&
                   (d as any).user_id?.id === options.where.user_id.id;
          }
        }
        return false;
      });
      
      // Special handling for Study repository with relations
      if (item && data === mockStudies && options.relations) {
        const studyWithRelations = {
          ...item,
          roles: mockRoles.filter(role => role.study.id === item.id),
          progress: mockProgress.filter(prog => prog.study.id === item.id),
          resources: mockResources.filter(res => res.study.id === item.id)
        };
        return Promise.resolve(studyWithRelations);
      }
      
      return Promise.resolve(item || null);
    }),
    findOneBy: jest.fn().mockImplementation((where: Partial<MockEntity>) => {
      const item = data.find((d) => {
        if (where.id) {
          return d.id === where.id;
        }
        // Handle study-specific queries
        if ((where as any).study && (where as any).study.id) {
          return (d as any).study?.id === (where as any).study.id;
        }
        return false;
      });
      return Promise.resolve(item || null);
    }),
    create: jest
      .fn()
      .mockImplementation((entityData: Partial<MockEntity>) => entityData),
    save: jest.fn().mockImplementation((entity: MockEntity) => {
      if (!entity.id) {
        entity.id = Math.floor(Math.random() * 1000) + 100;
      }
      return Promise.resolve(entity);
    }),
    delete: jest.fn().mockImplementation((criteria: any) => {
      let affected = 0;
      if (typeof criteria === 'number') {
        // Delete by ID
        const index = data.findIndex((d) => d.id === criteria);
        if (index !== -1) {
          data.splice(index, 1);
          affected = 1;
        }
      } else if (criteria && typeof criteria === 'object') {
        // Delete by criteria
        const indicesToRemove: number[] = [];
        data.forEach((item, index) => {
          let matches = true;
          if (criteria.id && item.id !== criteria.id) {
            matches = false;
          }
          if (
            criteria.study &&
            criteria.study.id &&
            (item as any).study?.id !== criteria.study.id
          ) {
            matches = false;
          }
          if (matches) {
            indicesToRemove.push(index);
          }
        });
        // Remove in reverse order to maintain indices
        indicesToRemove.reverse().forEach((index) => {
          data.splice(index, 1);
          affected++;
        });
      }
      return Promise.resolve({ affected, raw: {} });
    }),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockUsers),
    }),
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        StudyModule,
        AuthModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          if (key === 'JWT_SECRET') return 'test-secret-key-for-jwt-testing';
          return undefined;
        }),
      })
      .overrideProvider(getRepositoryToken(Study))
      .useValue(createMockRepository(mockStudies))
      .overrideProvider(getRepositoryToken(User))
      .useValue(createMockRepository(mockUsers))
      .overrideProvider(getRepositoryToken(Role))
      .useValue(createMockRepository(mockRoles))
      .overrideProvider(getRepositoryToken(Progress))
      .useValue(createMockRepository(mockProgress))
      .overrideProvider(getRepositoryToken(Resource))
      .useValue(createMockRepository(mockResources))
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    await app.init();

    // JWT 서비스와 토큰 설정
    jwtService = moduleFixture.get<JwtService>(JwtService);
    validToken = jwtService.sign({
      sub: 1,
      username: 'testuser',
      email: 'test@example.com'
    });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset mock data
    mockStudies.length = 0;
    mockStudies.push(
      {
        id: 1,
        study_name: 'Mock Study 1',
        start_year: 2025,
        study_description: 'Test Study 1',
        roles: [
          {
            id: 'role-1',
            role_name: 'Leader',
            user_id: mockUsers[1],
            study: { id: 1 },
          },
          {
            id: 'role-2',
            role_name: 'member',
            user_id: mockUsers[2],
            study: { id: 1 },
          },
        ],
        progress: [
          {
            id: 1,
            title: 'Week 1',
            content: 'Introduction to the study',
            study: { id: 1 },
          },
        ],
        resources: [
          {
            id: 1,
            name: 'study-guide.pdf',
            format: 'PDF',
            dir_path: '/uploads/study-guide.pdf',
            study: { id: 1 },
          },
        ],
      },
      {
        id: 2,
        study_name: 'Mock Study 2',
        start_year: 2024,
        study_description: 'Test Study 2',
        roles: [],
        progress: [],
        resources: [],
      }
    );
  });

  describe('/api/v1/study (GET)', () => {
    it('should return all studies', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study')
        .expect(200)
        .then((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body).toHaveLength(2);
        });
    });

    it('should return studies filtered by year', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study?year=2025')
        .expect(200)
        .then((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].start_year).toBe(2025);
        });
    });

    it('should return 400 for invalid year', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study?year=invalid')
        .expect(400);
    });
  });

  describe('/api/v1/study/:id (GET)', () => {
    it('should return study details for valid ID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveProperty('id', 1);
          expect(res.body).toHaveProperty('study_name');
          expect(res.body).toHaveProperty('leader');
          expect(res.body).toHaveProperty('members');
        });
    });

    it('should return 404 for non-existent study', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });

    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1')
        .expect(401);
    });
  });

  describe('/api/v1/study (POST)', () => {
    it('should create a new study', () => {
      const createStudyDto: CreateStudyDto = {
        study_name: 'New Study',
        start_year: 2025,
        study_description: 'New study description',
        leader_id: 1,
      };

      return request(app.getHttpServer())
        .post('/api/v1/study')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createStudyDto)
        .expect(201)
        .then((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('id');
        });
    });

    it('should return 401 when no JWT token is provided', () => {
      const createStudyDto: CreateStudyDto = {
        study_name: 'New Study',
        start_year: 2025,
        study_description: 'New study description',
        leader_id: 1,
      };

      return request(app.getHttpServer())
        .post('/api/v1/study')
        .send(createStudyDto)
        .expect(401);
    });

    it('should return 400 for invalid data', () => {
      const invalidDto = {
        study_name: '', // Invalid: empty string
        start_year: 1999, // Invalid: too old
        study_description: 'Test',
        leader_id: 1,
      };

      return request(app.getHttpServer())
        .post('/api/v1/study')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for non-existent leader', () => {
      const createStudyDto: CreateStudyDto = {
        study_name: 'New Study',
        start_year: 2025,
        study_description: 'New study description',
        leader_id: 999, // Non-existent user
      };

      return request(app.getHttpServer())
        .post('/api/v1/study')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createStudyDto)
        .expect(400);
    });
  });

  describe('/api/v1/study/:id (DELETE)', () => {
    it('should delete existing study', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1')
        .expect(401);
    });

    it('should return 404 for non-existent study', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/members (GET)', () => {
    it('should return study members', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/members')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeInstanceOf(Array);
        });
    });

    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/members')
        .expect(401);
    });

    it('should return 404 for non-existent study', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/999/members')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id (PATCH)', () => {
    it('should update study leader', () => {
      const updateDto: UpdateStudyLeaderDto = { user_id: 2 };

      return request(app.getHttpServer())
        .patch('/api/v1/study/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateDto)
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    it('should return 400 for missing user_id', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/study/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);
    });

    it('should return 404 for non-existent study', () => {
      const updateDto: UpdateStudyLeaderDto = { user_id: 2 };

      return request(app.getHttpServer())
        .patch('/api/v1/study/999')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateDto)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/members (POST)', () => {
    it('should add a new member', () => {
      const addMemberDto: AddStudyMemberDto = {
        user_id: 1, // Changed from 3 to 1 (user 1 is not yet a member of study 1)
        role_name: 'Member',
      };

      return request(app.getHttpServer())
        .post('/api/v1/study/1/members')
        .set('Authorization', `Bearer ${validToken}`)
        .send(addMemberDto)
        .expect(201)
        .then((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    it('should return 404 for non-existent study', () => {
      const addMemberDto: AddStudyMemberDto = {
        user_id: 3,
        role_name: 'Member',
      };

      return request(app.getHttpServer())
        .post('/api/v1/study/999/members')
        .set('Authorization', `Bearer ${validToken}`)
        .send(addMemberDto)
        .expect(404);
    });

    it('should return 404 for non-existent user', () => {
      const addMemberDto: AddStudyMemberDto = {
        user_id: 999,
        role_name: 'Member',
      };

      return request(app.getHttpServer())
        .post('/api/v1/study/1/members')
        .set('Authorization', `Bearer ${validToken}`)
        .send(addMemberDto)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/members/:userId (DELETE)', () => {
    it('should remove a member', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1/members/2')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    it('should return 404 for non-existent member', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1/members/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/progress (GET)', () => {
    it('should return study progress', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeInstanceOf(Array);
        });
    });

    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/progress')
        .expect(401);
    });

    it('should return 404 for non-existent study', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/999/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/progress (POST)', () => {
    it('should create new progress', () => {
      const createProgressDto: CreateProgressDto = {
        title: 'Week 2',
        content: 'Second week content',
      };

      return request(app.getHttpServer())
        .post('/api/v1/study/1/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createProgressDto)
        .expect(201)
        .then((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('id');
        });
    });

    it('should return 400 for invalid data', () => {
      const invalidDto = {
        title: '', // Invalid: empty title
        content: 'Test content',
      };

      return request(app.getHttpServer())
        .post('/api/v1/study/1/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 404 for non-existent study', () => {
      const createProgressDto: CreateProgressDto = {
        title: 'Week 2',
        content: 'Second week content',
      };

      return request(app.getHttpServer())
        .post('/api/v1/study/999/progress')
        .set('Authorization', `Bearer ${validToken}`)
        .send(createProgressDto)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/progress/:progressId (PATCH)', () => {
    it('should update progress', () => {
      const updateProgressDto: UpdateProgressDto = {
        title: 'Updated Week 1',
      };

      return request(app.getHttpServer())
        .patch('/api/v1/study/1/progress/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateProgressDto)
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    it('should return 400 for empty body', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/study/1/progress/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400); // The service should validate empty body
    });

    it('should return 404 for non-existent progress', () => {
      const updateProgressDto: UpdateProgressDto = {
        title: 'Updated Week 1',
      };

      return request(app.getHttpServer())
        .patch('/api/v1/study/1/progress/999')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateProgressDto)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/progress/:progressId (DELETE)', () => {
    it('should delete progress', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1/progress/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    it('should return 404 for non-existent progress', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1/progress/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/resources (GET)', () => {
    it('should return study resources', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/resources')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeInstanceOf(Array);
        });
    });

    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/resources')
        .expect(401);
    });

    it('should return 404 for non-existent study', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/999/resources')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/resources (POST)', () => {
    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .post('/api/v1/study/1/resources')
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .expect(401);
    });

    it('should return 400 for file upload without proper validation', () => {
      return request(app.getHttpServer())
        .post('/api/v1/study/1/resources')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .expect(400); // File validation will reject the test file
    });

    it('should return 400 for non-existent study with file upload', () => {
      return request(app.getHttpServer())
        .post('/api/v1/study/999/resources')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .expect(400); // File validation fails before study check
    });
  });

  describe('/api/v1/study/:id/resources/:resourceId (DELETE)', () => {
    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1/resources/1')
        .expect(401);
    });

    it('should delete a resource', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1/resources/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    it('should return 404 for non-existent resource', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/study/1/resources/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/study/:id/available-members (GET)', () => {
    it('should return available members', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/available-members?search=test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toBeInstanceOf(Array);
        });
    });

    it('should return 401 when no JWT token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/available-members?search=test')
        .expect(401);
    });

    it('should return 400 for short search term', () => {
      return request(app.getHttpServer())
        .get('/api/v1/study/1/available-members?search=a')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);
    });
  });
});
