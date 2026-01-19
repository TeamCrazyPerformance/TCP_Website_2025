import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('GET /api/v1/mypage/study/:id (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userToken: string;
  let otherUserToken: string;
  let userId: string;
  let otherUserId: string;
  let studyId: number;

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

    // 다른 사용자 생성
    const otherRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'otheruser',
        password: 'TestPassword123!',
        name: '다른유저',
        student_number: '20250002',
        phone_number: '010-8765-4321',
        email: 'other@example.com',
        major: '컴퓨터공학과',
        join_year: 2025,
        birth_date: '2000-02-02',
        gender: UserGender.Female,
        education_status: EducationStatus.Enrolled
      });

    // 로그인
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'TestPassword123!' });
    
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'otheruser', password: 'TestPassword123!' });

    userToken = userLogin.body.access_token;
    otherUserToken = otherLogin.body.access_token;
    
    // 사용자 ID 가져오기
    const userResult = await dataSource.query(
      `SELECT id FROM "user" WHERE username = 'testuser'`
    );
    const otherUserResult = await dataSource.query(
      `SELECT id FROM "user" WHERE username = 'otheruser'`
    );
    userId = userResult[0].id;
    otherUserId = otherUserResult[0].id;

    // 스터디 생성
    const studyResult = await dataSource.query(
      `INSERT INTO "Study" (study_name, study_description, period, place, way, tag, recruit_count, start_year, apply_deadline, created_at, updated_at)
       VALUES ('알고리즘 스터디', '백준 문제 풀이 스터디입니다', '2026-01-01 ~ 2026-12-31', '학교 스터디룸', '오프라인', '알고리즘', 5, 2026, NOW() + INTERVAL '1 year', NOW(), NOW())
       RETURNING id`
    );
    studyId = studyResult[0].id;

    // 스터디 멤버로 등록 (testuser만 MEMBER)
    await dataSource.query(
      `INSERT INTO "StudyMember" (user_id, study_id, role, created_at, updated_at)
       VALUES ($1, $2, 'MEMBER', NOW(), NOW())`,
      [userId, studyId]
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
      .get(`/api/v1/mypage/study/${studyId}`);

    expect(response.status).toBe(401);
  });

  it('스터디 멤버는 상세 정보를 조회할 수 있음', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/study/${studyId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', studyId);
    expect(response.body).toHaveProperty('study_name', '알고리즘 스터디');
    expect(response.body).toHaveProperty('study_description');
    expect(response.body).toHaveProperty('tag', '알고리즘');
    expect(response.body).toHaveProperty('period', '2026-01-01 ~ 2026-12-31');
    expect(response.body).toHaveProperty('place', '학교 스터디룸');
    expect(response.body).toHaveProperty('way', '오프라인');
    expect(response.body).toHaveProperty('memberCount');
    expect(response.body).toHaveProperty('progress');
  });

  it('스터디 멤버가 아닌 사용자는 403 반환', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/study/${studyId}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Access denied');
  });

  it('존재하지 않는 스터디는 404 반환', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/study/9999')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('not found');
  });

  it('진행률은 0-100 사이의 숫자여야 함', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/study/${studyId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(typeof response.body.progress).toBe('number');
    expect(response.body.progress).toBeGreaterThanOrEqual(0);
    expect(response.body.progress).toBeLessThanOrEqual(100);
  });
});
