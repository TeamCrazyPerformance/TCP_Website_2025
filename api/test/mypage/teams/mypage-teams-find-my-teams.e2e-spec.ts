import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';
import { ExecutionType } from '../../../src/teams/entities/enums/execution-type.enum';

describe('GET /api/v1/mypage/teams (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userToken: string;
  let leaderToken: string;
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
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    const leaderRegister = await request(app.getHttpServer())
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

    // 로그인
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'TestPassword123!' });
    
    const leaderLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'teamleader', password: 'TestPassword123!' });

    userToken = userLogin.body.access_token;
    leaderToken = leaderLogin.body.access_token;

    // 팀 생성
    const teamCreate = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        title: '테스트 프로젝트',
        category: '개발',
        periodStart: '2024-01-01',
        periodEnd: '2024-06-30',
        deadline: '2024-12-31',
        description: '테스트 프로젝트 설명',
        techStack: 'Node.js, React',
        contact: 'contact@example.com',
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
      .get('/api/v1/mypage/teams');

    expect(response.status).toBe(401);
  });

  it('일반 사용자는 지원한 팀 목록을 조회할 수 있음', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/teams')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('recruitingTeams');
    expect(response.body).toHaveProperty('appliedTeams');
    expect(response.body).toHaveProperty('completedTeams');
    
    expect(response.body.recruitingTeams).toHaveLength(0);
    expect(response.body.appliedTeams).toHaveLength(1);
    expect(response.body.appliedTeams[0]).toHaveProperty('appliedRole');
    expect(response.body.appliedTeams[0].title).toBe('테스트 프로젝트');
  });

  it('리더는 모집중인 팀 목록을 조회할 수 있음', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/teams')
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruitingTeams).toHaveLength(1);
    expect(response.body.appliedTeams).toHaveLength(0);
    expect(response.body.completedTeams).toHaveLength(0);
    expect(response.body.recruitingTeams[0].title).toBe('테스트 프로젝트');
  });

  it('각 배열의 데이터 구조가 올바른지 확인', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/teams')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    
    const { appliedTeams } = response.body;
    expect(appliedTeams[0]).toHaveProperty('id');
    expect(appliedTeams[0]).toHaveProperty('title');
    expect(appliedTeams[0]).toHaveProperty('leader');
    expect(appliedTeams[0]).toHaveProperty('roles');
    expect(appliedTeams[0]).toHaveProperty('appliedRole');
    expect(appliedTeams[0].appliedRole).toHaveProperty('roleName');
  });
});
