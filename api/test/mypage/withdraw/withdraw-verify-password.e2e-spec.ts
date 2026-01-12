import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('POST /api/v1/mypage/withdraw/verify-password (e2e)', () => {
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
  });

  beforeEach(async () => {
    // 데이터 정리
    await dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`);
    
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
        birth_date: '2000-01-01',
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
    await dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`);
    await app.close();
  });

  it('올바른 비밀번호로 검증 시 201 반환', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/mypage/withdraw/verify-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        password: 'TestPassword123!'
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ verified: true });
  });

  it('잘못된 비밀번호로 검증 시 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/mypage/withdraw/verify-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        password: 'WrongPassword123!'
      });

    expect(response.status).toBe(401);
  });

  it('비밀번호 누락 시 400 반환', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/mypage/withdraw/verify-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it('빈 비밀번호 전송 시 400 반환', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/mypage/withdraw/verify-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        password: ''
      });

    expect(response.status).toBe(400);
  });

  it('인증 토큰 없을 시 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/mypage/withdraw/verify-password')
      .send({
        password: 'TestPassword123!'
      });

    expect(response.status).toBe(401);
  });
});
