import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('PATCH /api/v1/mypage/privacy (e2e)', () => {
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

  it('단일 프라이버시 설정 업데이트 시 200 반환', async () => {
    const updateData = {
      is_public_email: true,
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.is_public_email).toBe(true);
    
    // 다른 필드는 변경되지 않았는지 확인
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(getResponse.body.is_public_email).toBe(true);
    // 다른 설정들은 기본값(false) 유지
    expect(getResponse.body.is_public_tech_stack).toBe(false);
    expect(getResponse.body.is_public_github_username).toBe(false);
    expect(getResponse.body.is_public_portfolio_link).toBe(false);
  });

  it('다중 프라이버시 설정 업데이트 시 200 반환', async () => {
    const updateData = {
      is_public_email: true,
      is_public_tech_stack: true,
      is_public_github_username: false,
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    
    // 업데이트된 값들 확인
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(getResponse.body.is_public_email).toBe(true);
    expect(getResponse.body.is_public_tech_stack).toBe(true);
    expect(getResponse.body.is_public_github_username).toBe(false);
    // 요청에 포함되지 않은 필드는 기본값 유지
    expect(getResponse.body.is_public_portfolio_link).toBe(false);
  });

  it('점진적 업데이트 테스트 - 토글 시나리오', async () => {
    // 1. 이메일 공개 설정
    await request(app.getHttpServer())
      .patch('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ is_public_email: true })
      .expect(200);

    // 2. 이메일 공개 해제
    await request(app.getHttpServer())
      .patch('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ is_public_email: false })
      .expect(200);

    // 최종 상태 확인
    const finalResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`);

    expect(finalResponse.body.is_public_email).toBe(false);
    expect(finalResponse.body.is_public_tech_stack).toBe(false);
    expect(finalResponse.body.is_public_github_username).toBe(false);
    expect(finalResponse.body.is_public_portfolio_link).toBe(false);
  });

  it('유효하지 않은 데이터 타입 시 400 반환', async () => {
    const invalidData = {
      is_public_email: 'not_boolean', // boolean이 아닌 값
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/privacy')
      .set('Authorization', `Bearer ${userToken}`)
      .send(invalidData);

    expect(response.status).toBe(400);
  });

  it('인증 토큰 없을 시 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/privacy')
      .send({ is_public_email: true });

    expect(response.status).toBe(401);
  });

});
