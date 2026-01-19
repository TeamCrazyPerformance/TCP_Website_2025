import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('PATCH /api/v1/mypage/account/password (e2e)', () => {
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

  it('비밀번호 변경 시 200 반환', async () => {
    const passwordData = {
      currentPassword: 'TestPassword123!',
      newPassword: 'NewPassword456!A',
      confirmPassword: 'NewPassword456!A',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send(passwordData);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Password changed successfully');

    // 새 비밀번호로 로그인 가능한지 확인
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'NewPassword456!A' });
    
    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body).toHaveProperty('access_token');
  });

  it('현재 비밀번호 틀림 시 403 반환', async () => {
    const passwordData = {
      currentPassword: 'WrongPassword123!',
      newPassword: 'NewPassword456!A',
      confirmPassword: 'NewPassword456!A',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send(passwordData);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Current password is incorrect');
  });

  it('새 비밀번호와 확인 비밀번호 불일치 시 400 반환', async () => {
    const passwordData = {
      currentPassword: 'TestPassword123!',
      newPassword: 'NewPassword456!A',
      confirmPassword: 'DifferentPassword789!A',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send(passwordData);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Passwords do not match');
  });

  it('새 비밀번호가 현재 비밀번호와 같을 시 400 반환', async () => {
    const passwordData = {
      currentPassword: 'TestPassword123!',
      newPassword: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send(passwordData);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('New password must be different from old password');
  });

  it('비밀번호 형식 오류 시 400 반환', async () => {
    const passwordData = {
      currentPassword: 'TestPassword123!',
      newPassword: 'weak', // 너무 약함
      confirmPassword: 'weak',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send(passwordData);

    expect(response.status).toBe(400);
  });

  it('인증 토큰 없을 시 401 반환', async () => {
    const passwordData = {
      currentPassword: 'TestPassword123!',
      newPassword: 'NewPassword456!A',
      confirmPassword: 'NewPassword456!A',
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account/password')
      .send(passwordData);

    expect(response.status).toBe(401);
  });
});
