import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';
import { ExecutionType } from '../../../src/teams/entities/enums/execution-type.enum';

describe('GET /api/v1/mypage/teams/:id (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userToken: string;
  let leaderToken: string;
  let outsiderToken: string;
  let teamId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // 테이블 초기화
    await dataSource.query('TRUNCATE TABLE "team_member" RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE "team_role" RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE "team" RESTART IDENTITY CASCADE;');
    await dataSource.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');

    // 테스트 사용자들 생성
    await request(app.getHttpServer())
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
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'teamleader',
        password: 'TestPassword123!',
        name: '팀리더',
        student_number: '20240001',
        phone_number: '010-5678-1234',
        email: 'leader@example.com',
        major: '컴퓨터공학과',
        join_year: 2024,
        birth_date: new Date('1999-01-01'),
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'outsider',
        password: 'TestPassword123!',
        name: '외부인',
        student_number: '20230001',
        phone_number: '010-9999-9999',
        email: 'outsider@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    // 로그인
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'TestPassword123!' });
    
    const leaderLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'teamleader', password: 'TestPassword123!' });

    const outsiderLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'outsider', password: 'TestPassword123!' });

    userToken = userLogin.body.access_token;
    leaderToken = leaderLogin.body.access_token;
    outsiderToken = outsiderLogin.body.access_token;

    // 팀 생성
    const teamCreate = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        title: '마이페이지 테스트 프로젝트',
        category: '개발',
        periodStart: '2024-01-01',
        periodEnd: '2024-06-30',
        deadline: '2024-12-31',
        description: '마이페이지 테스트용 프로젝트',
        techStack: 'Node.js, React',
        contact: 'team@example.com',
        executionType: ExecutionType.ONLINE,
        roles: [
          { roleName: '백엔드 개발자', recruitCount: 2 },
          { roleName: '프론트엔드 개발자', recruitCount: 1 }
        ]
      });

    teamId = teamCreate.body.id;

    // 사용자가 팀에 지원
    await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/apply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ roleId: 1 });
  }, 30000);

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  it('인증 없이 접근하면 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/teams/${teamId}`);

    expect(response.status).toBe(401);
  });

  it('존재하지 않는 팀 조회시 404 반환', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/teams/999')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(404);
  });

  it('잘못된 teamId 형식은 400 반환', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/teams/invalid-id')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(400);
  });

  it('관련 없는 사용자 접근시 403 반환', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/teams/${teamId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
  });

  it('리더는 지원자 개인정보가 포함된 팀 상세정보 조회 가능', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/teams/${teamId}`)
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.isLeader).toBe(true);
    expect(response.body).toHaveProperty('applicants');
    expect(response.body.applicants).toHaveLength(1);
    
    const applicant = response.body.applicants[0];
    expect(applicant).toHaveProperty('name', '테스트유저');
    expect(applicant).toHaveProperty('phoneNumber', '010-1234-5678');
    expect(applicant).toHaveProperty('email', 'test@example.com');
    expect(applicant).toHaveProperty('role');
    expect(applicant.role.roleName).toBe('백엔드 개발자');
  });

  it('일반 멤버는 기본 팀 정보만 조회 가능', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/teams/${teamId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.isLeader).toBe(false);
    expect(response.body).not.toHaveProperty('applicants');
    expect(response.body.title).toBe('마이페이지 테스트 프로젝트');
    expect(response.body).toHaveProperty('leader');
    expect(response.body).toHaveProperty('roles');
  });

  it('리더 응답에 모든 팀 정보가 포함되어야 함', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/mypage/teams/${teamId}`)
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', teamId);
    expect(response.body).toHaveProperty('title');
    expect(response.body).toHaveProperty('category');
    expect(response.body).toHaveProperty('description');
    expect(response.body).toHaveProperty('leader');
    expect(response.body).toHaveProperty('roles');
    expect(response.body).toHaveProperty('status');
  });
});
