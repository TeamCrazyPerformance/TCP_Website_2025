import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';

import { RecruitmentController } from '../src/recruitment/recruitment.controller';
import { RecruitmentService } from '../src/recruitment/recruitment.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

// Mock data
const mockResumes = [
  {
    id: 1,
    name: '홍길동',
    student_number: '20231234',
    major: '컴퓨터공학과',
    phone_number: '010-1234-5678',
    tech_stack: 'React, NestJS',
    area_interest: 'Deep Learning',
    self_introduction: '안녕하세요',
    club_expectation: '성장하고 싶습니다',
    submit_year: 2025,
    awards: [{ id: 1, award_name: '우수상' }],
    projects: [{ id: 1, project_name: 'TCP 웹사이트' }],
  },
];

// Mock RecruitmentService
const mockRecruitmentService = {
  create: jest.fn().mockResolvedValue({ success: true, id: 1 }),
  findAll: jest.fn().mockResolvedValue(mockResumes),
  findOne: jest.fn().mockImplementation((id: number) => {
    const resume = mockResumes.find((r) => r.id === id);
    if (!resume) {
      throw { response: { statusCode: 404, message: 'Resume not found' } };
    }
    return Promise.resolve(resume);
  }),
  update: jest.fn().mockResolvedValue({ success: true }),
  remove: jest.fn().mockResolvedValue({ success: true }),
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({
    sub: 1,
    userId: 1,
    username: 'admin',
    role: 'ADMIN',
  }),
};

// Mock Guards
const mockJwtAuthGuard = {
  canActivate: jest.fn().mockImplementation((context) => {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    request.user = { userId: 1, username: 'admin', role: 'ADMIN' };
    return true;
  }),
};

const mockRolesGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

describe('RecruitmentController (e2e)', () => {
  let app: INestApplication;
  const validToken = 'valid-admin-token';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RecruitmentController],
      providers: [
        {
          provide: RecruitmentService,
          useValue: mockRecruitmentService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/recruitment', () => {
    it('should create recruitment with valid data (201 Created)', async () => {
      const validDto = {
        name: '홍길동',
        student_number: '20231234',
        major: '컴퓨터공학과',
        phone_number: '010-1234-5678',
        tech_stack: 'React, NestJS',
        awards: [
          {
            award_name: '우수상',
            award_institution: '한국대학교',
            award_date: '2023-12-01',
            award_description: '프로젝트 우수상',
          },
        ],
        projects: [
          {
            project_name: 'TCP 웹사이트',
            project_contribution: '백엔드 개발',
            project_date: '2024-01-01',
            project_description: 'NestJS 기반 백엔드 개발',
            project_tech_stack: 'NestJS, TypeORM',
          },
        ],
        area_interest: 'Deep Learning',
        self_introduction: '안녕하세요',
        club_expectation: '성장하고 싶습니다',
        submit_year: 2025,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/recruitment')
        .send(validDto)
        .expect(201);

      expect(response.body).toEqual({ success: true, id: 1 });
      expect(mockRecruitmentService.create).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', () => {
      const invalidDto = {
        student_number: '20250001',
        major: '컴퓨터공학과',
        // name field missing
      };

      return request(app.getHttpServer())
        .post('/api/v1/recruitment')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /api/v1/recruitment', () => {
    it('should return 401 when no JWT token is provided', () => {
      mockJwtAuthGuard.canActivate.mockReturnValueOnce(false);

      return request(app.getHttpServer())
        .get('/api/v1/recruitment')
        .expect(403); // Guard returns false -> 403
    });

    it('should return all recruitments with valid admin token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/recruitment')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(mockRecruitmentService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/recruitment/:id', () => {
    it('should return 403 when no JWT token is provided', () => {
      mockJwtAuthGuard.canActivate.mockReturnValueOnce(false);

      return request(app.getHttpServer())
        .get('/api/v1/recruitment/1')
        .expect(403);
    });

    it('should return specific recruitment with valid admin token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/recruitment/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name', '홍길동');
      expect(mockRecruitmentService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('PATCH /api/v1/recruitment/:id', () => {
    it('should return 403 when no JWT token is provided', () => {
      mockJwtAuthGuard.canActivate.mockReturnValueOnce(false);
      const updateDto = { name: '김수정' };

      return request(app.getHttpServer())
        .patch('/api/v1/recruitment/1')
        .send(updateDto)
        .expect(403);
    });

    it('should update recruitment with valid admin token', async () => {
      const updateDto = { name: '김수정', major: '정보보호학과' };

      const response = await request(app.getHttpServer())
        .patch('/api/v1/recruitment/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockRecruitmentService.update).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/recruitment/:id', () => {
    it('should return 403 when no JWT token is provided', () => {
      mockJwtAuthGuard.canActivate.mockReturnValueOnce(false);

      return request(app.getHttpServer())
        .delete('/api/v1/recruitment/1')
        .expect(403);
    });

    it('should delete recruitment with valid admin token', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/recruitment/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(mockRecruitmentService.remove).toHaveBeenCalledWith(1);
    });
  });
});
