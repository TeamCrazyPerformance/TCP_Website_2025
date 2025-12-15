import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Resume } from '../src/recruitment/entities/resume.entity';
import { Award } from '../src/recruitment/entities/award.entity';
import { Project } from '../src/recruitment/entities/project.entity';
import { Repository } from 'typeorm';

describe('RecruitmentController (e2e)', () => {
  let app: INestApplication;
  let resumeRepository: Repository<Resume>;
  let createdResumeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // E2E 테스트에서도 main.ts와 동일하게 ValidationPipe를 적용
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();

    // Repository 가져오기
    resumeRepository = moduleFixture.get<Repository<Resume>>(
      getRepositoryToken(Resume),
    );
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    if (createdResumeId) {
      await resumeRepository.delete(createdResumeId);
    }
    await app.close();
  });

  describe('POST /api/v1/recruitment', () => {
    it('모든 필드를 올바르게 입력하여 제출 - { success: true } 반환', async () => {
      // given
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

      // when & then
      const response = await request(app.getHttpServer())
        .post('/api/v1/recruitment')
        .send(validDto)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('id');
      
      // 생성된 ID 저장 (cleanup용)
      createdResumeId = response.body.id;

      // DB에 실제로 저장되었는지 확인
      const savedResume = await resumeRepository.findOne({
        where: { id: createdResumeId },
        relations: ['awards', 'projects'],
      });
      expect(savedResume).toBeDefined();
      expect(savedResume?.name).toBe('홍길동');
      expect(savedResume?.awards).toHaveLength(1);
      expect(savedResume?.projects).toHaveLength(1);
    });

    it('필수 필드 누락 (예: name 없음) - 400 Bad Request 반환', () => {
      // given
      const invalidDto = {
        student_number: '20250001',
        major: '컴퓨터공학과',
        // 'name' 필드 누락
      };

      // when & then
      return request(app.getHttpServer())
        .post('/api/v1/recruitment')
        .send(invalidDto)
        .expect(400);
    });

    it('서버 내부 오류 - 500 Internal Server Error 반환', async () => {
      // given: Repository를 일시적으로 mock하여 에러 발생시키기
      const saveSpy = jest
        .spyOn(resumeRepository, 'save')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const validDto = {
        name: '테스트',
        student_number: '20250002',
        major: '컴퓨터공학과',
        phone_number: '010-1111-2222',
        area_interest: 'AI',
        self_introduction: '테스트',
        club_expectation: '테스트',
        submit_year: 2025,
      };

      // when & then
      await request(app.getHttpServer())
        .post('/api/v1/recruitment')
        .send(validDto)
        .expect(500);

      // cleanup
      saveSpy.mockRestore();
    });
  });

  describe('GET /api/v1/recruitment', () => {
    it('관리자가 토큰을 가지고 전체 지원서 조회 요청 - 전체 지원서 배열 반환 (200 OK)', async () => {
      // given: 실제 인증이 구현되기 전까지는 토큰 없이 테스트
      // TODO: JWT 인증 구현 후 실제 관리자 토큰으로 수정
      const adminToken = 'valid-admin-token';

      // when & then
      const response = await request(app.getHttpServer())
        .get('/api/v1/recruitment')
        // .set('Authorization', `Bearer ${adminToken}`) // 인증 구현 후 주석 해제
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('student_number');
      }
    });

    it.skip('인증 토큰 누락 - 401 Unauthorized 반환', () => {
      // TODO: JWT Guard 구현 후 테스트 활성화
      return request(app.getHttpServer())
        .get('/api/v1/recruitment')
        .expect(401);
    });

    it.skip('권한 없는 사용자 토큰으로 호출 - 403 Forbidden resource 반환', () => {
      // TODO: Role Guard 구현 후 테스트 활성화
      const nonAdminToken = 'valid-user-token-but-not-admin';

      return request(app.getHttpServer())
        .get('/api/v1/recruitment')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toContain('Forbidden');
        });
    });
  });

  describe('GET /api/v1/recruitment/:id', () => {
    it('관리자가 토큰을 가지고 특정 지원서 조회 요청 - 지원서 객체 반환 (200 OK)', async () => {
      // given: createdResumeId 사용
      // TODO: JWT 인증 구현 후 실제 관리자 토큰으로 수정
      const adminToken = 'valid-admin-token';

      // when & then
      const response = await request(app.getHttpServer())
        .get(`/api/v1/recruitment/${createdResumeId}`)
        // .set('Authorization', `Bearer ${adminToken}`) // 인증 구현 후 주석 해제
        .expect(200);

      expect(response.body).toHaveProperty('id', createdResumeId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('awards');
      expect(response.body).toHaveProperty('projects');
    });

    it.skip('인증 토큰 누락 - 401 Unauthorized 반환', () => {
      // TODO: JWT Guard 구현 후 테스트 활성화
      return request(app.getHttpServer())
        .get(`/api/v1/recruitment/${createdResumeId}`)
        .expect(401);
    });

    it.skip('권한 없는 사용자 토큰으로 호출 - 403 Forbidden resource 반환', () => {
      // TODO: Role Guard 구현 후 테스트 활성화
      const nonAdminToken = 'valid-user-token-but-not-admin';

      return request(app.getHttpServer())
        .get(`/api/v1/recruitment/${createdResumeId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('존재하지 않는 id로 요청 - 404 Recruitment not found 반환', () => {
      // given
      const nonExistentId = 999999;

      // when & then
      return request(app.getHttpServer())
        .get(`/api/v1/recruitment/${nonExistentId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });
  });

  describe('PATCH /api/v1/recruitment/:id', () => {
    it('관리자가 토큰을 가지고 특정 지원서 수정 요청 - {"success": true} 반환 (200 OK)', async () => {
      // given
      // TODO: JWT 인증 구현 후 실제 관리자 토큰으로 수정
      const adminToken = 'valid-admin-token';
      const updateDto = {
        name: '김수정',
        major: '정보보호학과',
      };

      // when & then
      await request(app.getHttpServer())
        .patch(`/api/v1/recruitment/${createdResumeId}`)
        // .set('Authorization', `Bearer ${adminToken}`) // 인증 구현 후 주석 해제
        .send(updateDto)
        .expect(200)
        .expect({ success: true });

      // DB에 실제로 업데이트되었는지 확인
      const updatedResume = await resumeRepository.findOne({
        where: { id: createdResumeId },
      });
      expect(updatedResume?.name).toBe('김수정');
      expect(updatedResume?.major).toBe('정보보호학과');
    });

    it.skip('인증 토큰 누락 - 401 Unauthorized 반환', () => {
      // TODO: JWT Guard 구현 후 테스트 활성화
      const updateDto = { name: '김수정' };

      return request(app.getHttpServer())
        .patch(`/api/v1/recruitment/${createdResumeId}`)
        .send(updateDto)
        .expect(401);
    });

    it.skip('권한 없는 사용자 토큰으로 호출 - 403 Forbidden resource 반환', () => {
      // TODO: Role Guard 구현 후 테스트 활성화
      const nonAdminToken = 'valid-user-token-but-not-admin';
      const updateDto = { name: '김수정' };

      return request(app.getHttpServer())
        .patch(`/api/v1/recruitment/${createdResumeId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send(updateDto)
        .expect(403);
    });

    it('존재하지 않는 id로 요청 - 404 Recruitment not found 반환', () => {
      // given
      const nonExistentId = 999999;
      const updateDto = { name: '김수정' };

      // when & then
      return request(app.getHttpServer())
        .patch(`/api/v1/recruitment/${nonExistentId}`)
        .send(updateDto)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });
  });

  describe('DELETE /api/v1/recruitment/:id', () => {
    let tempResumeId: number;

    beforeEach(async () => {
      // 삭제 테스트용 임시 데이터 생성
      const tempResume = resumeRepository.create({
        name: '삭제테스트',
        student_number: '20259999',
        major: '테스트학과',
        phone_number: '010-9999-9999',
        area_interest: '테스트',
        self_introduction: '테스트',
        club_expectation: '테스트',
        submit_year: 2025,
      });
      const saved = await resumeRepository.save(tempResume);
      tempResumeId = saved.id;
    });

    it('관리자가 토큰을 가지고 특정 지원서 삭제 요청 - {"success": true} 반환 (200 OK)', async () => {
      // given
      // TODO: JWT 인증 구현 후 실제 관리자 토큰으로 수정
      const adminToken = 'valid-admin-token';

      // when & then
      await request(app.getHttpServer())
        .delete(`/api/v1/recruitment/${tempResumeId}`)
        // .set('Authorization', `Bearer ${adminToken}`) // 인증 구현 후 주석 해제
        .expect(200)
        .expect({ success: true });

      // DB에서 실제로 삭제되었는지 확인
      const deletedResume = await resumeRepository.findOne({
        where: { id: tempResumeId },
      });
      expect(deletedResume).toBeNull();
    });

    it.skip('인증 토큰 누락 - 401 Unauthorized 반환', () => {
      // TODO: JWT Guard 구현 후 테스트 활성화
      return request(app.getHttpServer())
        .delete(`/api/v1/recruitment/${tempResumeId}`)
        .expect(401);
    });

    it.skip('권한 없는 사용자 토큰으로 호출 - 403 Forbidden resource 반환', () => {
      // TODO: Role Guard 구현 후 테스트 활성화
      const nonAdminToken = 'valid-user-token-but-not-admin';

      return request(app.getHttpServer())
        .delete(`/api/v1/recruitment/${tempResumeId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('존재하지 않는 id로 요청 - 404 Recruitment not found 반환', () => {
      // given
      const nonExistentId = 999999;

      // when & then
      return request(app.getHttpServer())
        .delete(`/api/v1/recruitment/${nonExistentId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });
  });
});
