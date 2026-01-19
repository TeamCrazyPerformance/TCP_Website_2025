import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('GET /api/v1/mypage/study (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // 테이블 초기화
    await dataSource.query('TRUNCATE TABLE "StudyMember" RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE "Study" RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');

    // 테스트 사용자 생성
    const userRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'testuser',
        password: 'TestPassword123!',
        name: '테스트유저',
        student_number: '20250001',
        phone_number: '010-1234-5678',
        email: 'test@example.com',
        major: '컴퓨터공학과',
        join_year: 2025,
        birth_date: '2000-01-01',
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    expect(userRegister.status).toBe(201);

    // 로그인
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'TestPassword123!' });
    
    userToken = loginResponse.body.access_token;
    
    // 사용자 ID 가져오기
    const userResult = await dataSource.query(
      `SELECT id FROM "user" WHERE username = 'testuser'`
    );
    userId = userResult[0].id;

    // 진행중인 스터디 생성
    await dataSource.query(
      `INSERT INTO "Study" (study_name, study_description, period, place, way, tag, recruit_count, start_year, apply_deadline, created_at, updated_at)
       VALUES ('알고리즘 스터디', '백준 문제 풀이', '2026-01-01 ~ 2026-12-31', '학교 스터디룸', '오프라인', '알고리즘', 5, 2026, NOW() + INTERVAL '1 year', NOW(), NOW())`
    );

    // 완료된 스터디 생성
    await dataSource.query(
      `INSERT INTO "Study" (study_name, study_description, period, place, way, tag, recruit_count, start_year, apply_deadline, created_at, updated_at)
       VALUES ('웹 개발 스터디', 'React 스터디', '2025-01-01 ~ 2025-12-31', '온라인', '온라인', 'React', 4, 2025, NOW(), NOW(), NOW())`
    );

    // 스터디 멤버로 등록 (MEMBER 역할)
    await dataSource.query(
      `INSERT INTO "StudyMember" (user_id, study_id, role, created_at, updated_at)
       VALUES ($1, 1, 'MEMBER', NOW(), NOW()), ($1, 2, 'MEMBER', NOW(), NOW())`,
      [userId]
    );
  });

  afterAll(async () => {
    await dataSource.query('TRUNCATE TABLE "StudyMember" RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE "Study" RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await app.close();
  });

  it('인증 없이 접근하면 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/study');

    expect(response.status).toBe(401);
  });

  it('인증된 사용자는 진행중/완료된 스터디 목록을 조회할 수 있음', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/study')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('ongoingStudies');
    expect(response.body).toHaveProperty('completedStudies');
    expect(Array.isArray(response.body.ongoingStudies)).toBe(true);
    expect(Array.isArray(response.body.completedStudies)).toBe(true);
  });

  it('진행중인 스터디는 올바른 필드를 포함함', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/study')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    
    const ongoingStudies = response.body.ongoingStudies;
    if (ongoingStudies.length > 0) {
      const study = ongoingStudies[0];
      expect(study).toHaveProperty('id');
      expect(study).toHaveProperty('study_name');
      expect(study).toHaveProperty('period');
      expect(study).toHaveProperty('memberCount');
      expect(study).toHaveProperty('way');
      expect(study).toHaveProperty('tag');
    }
  });

  it('완료된 스터디는 올바른 필드를 포함함', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/study')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    
    const completedStudies = response.body.completedStudies;
    if (completedStudies.length > 0) {
      const study = completedStudies[0];
      expect(study).toHaveProperty('id');
      expect(study).toHaveProperty('study_name');
      expect(study).toHaveProperty('period');
      expect(study).toHaveProperty('memberCount');
      expect(study).toHaveProperty('way');
      expect(study).toHaveProperty('tag');
    }
  });
});
