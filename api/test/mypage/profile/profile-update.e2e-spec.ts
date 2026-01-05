import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('PATCH /api/v1/mypage/profile (e2e)', () => {
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
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled,
        github_username: 'testuser_github',
        self_description: '안녕하세요. 테스트 사용자입니다.'
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

  it('유효한 데이터로 업데이트 시 200 반환', async () => {
    const updateData = {
      self_description: '업데이트된 자기소개입니다.',
      tech_stack: ['React', 'Next.js', 'TypeScript'],
      education_status: EducationStatus.Graduated,
      github_username: 'updated_github',
      portfolio_link: 'https://new-portfolio.example.com',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.self_description).toBe(updateData.self_description);
    expect(response.body.tech_stack).toEqual(updateData.tech_stack);
    expect(response.body.education_status).toBe(updateData.education_status);
    expect(response.body.github_username).toBe(updateData.github_username);
    expect(response.body.portfolio_link).toBe(updateData.portfolio_link);
  });

  it('부분 업데이트 시 200 반환', async () => {
    const updateData = {
      self_description: '새로운 자기소개',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.self_description).toBe(updateData.self_description);
    // 다른 필드는 변경되지 않아야 함
    expect(response.body.github_username).toBe('testuser_github');
    expect(response.body.portfolio_link).toBe(null);
  });

  it('빈 업데이트 시 200 반환', async () => {
    const updateData = {};

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    // 기존 데이터가 그대로 유지되어야 함
    expect(response.body.github_username).toBe('testuser_github');
    expect(response.body.self_description).toBe('안녕하세요. 테스트 사용자입니다.');
    expect(response.body.portfolio_link).toBe(null);
  });

  it('인증 토큰 없을 시 401 반환', async () => {
    const updateData = {
      self_description: '업데이트 시도',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/profile')
      .send(updateData);

    expect(response.status).toBe(401);
  });
});
