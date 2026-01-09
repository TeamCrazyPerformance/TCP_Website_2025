import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('GET /api/v1/mypage/privacy (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    await dataSource.query(
      `TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`
    );

    // 테스트용 사용자 생성 (회원가입)
    const userRegisterRes = await request(app.getHttpServer())
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

    expect(userRegisterRes.status).toBe(201);

    // 로그인하여 토큰 획득
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'TestPassword123!' });
    
    userToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await dataSource.query(
      `TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`
    );
    await app.close();
  });

  it('정상 인증 시 200 반환 및 프라이버시 설정 조회', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('is_public_email');
    expect(response.body).toHaveProperty('is_public_tech_stack');
    expect(response.body).toHaveProperty('is_public_education_status');
    expect(response.body).toHaveProperty('is_public_github_username');
    expect(response.body).toHaveProperty('is_public_portfolio_link');
    
    // 기본값 확인 (boolean 타입인지)
    expect(typeof response.body.is_public_email).toBe('boolean');
    expect(typeof response.body.is_public_tech_stack).toBe('boolean');
    expect(typeof response.body.is_public_education_status).toBe('boolean');
    expect(typeof response.body.is_public_github_username).toBe('boolean');
    expect(typeof response.body.is_public_portfolio_link).toBe('boolean');
  });

  it('인증 토큰 없을 시 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/mypage/privacy');

    expect(response.status).toBe(401);
  });
});
