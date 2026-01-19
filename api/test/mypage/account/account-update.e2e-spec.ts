import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('PATCH /api/v1/mypage/account (e2e)', () => {
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

  it('이름 변경 시 200 반환', async () => {
    const updateData = { name: '변경된이름' };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Account information updated successfully');

    // 변경 확인
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(getResponse.body.name).toBe('변경된이름');
  });

  it('전화번호 변경 시 200 반환', async () => {
    const updateData = { phone_number: '010-9999-8888' };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);

    // 변경 확인
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(getResponse.body.phoneNumber).toBe('010-9999-8888');
  });

  it('잘못된 전화번호 형식 시 400 반환', async () => {
    const updateData = { phone_number: '01012345678' }; // 하이픈 없음

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(400);
  });

  it('이메일 변경 시 200 반환', async () => {
    const updateData = { email: 'newemail@example.com' };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);

    // 변경 확인
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(getResponse.body.email).toBe('newemail@example.com');
  });

  it('중복 이메일 시 400 반환', async () => {
    // 다른 사용자 생성
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'anotheruser',
        password: 'TestPassword123!',
        name: '다른유저',
        student_number: '20250002',
        phone_number: '010-5555-6666',
        email: 'another@example.com',
        major: '소프트웨어학과',
        join_year: 2025,
        birth_date: '2001-02-02',
        gender: UserGender.Female,
        education_status: EducationStatus.Enrolled
      });

    // 다른 사용자의 이메일로 변경 시도
    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ email: 'another@example.com' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Email already in use');
  });

  it('생일 변경 시 200 반환', async () => {
    const updateData = { birth_date: '1995-05-05' };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);

    // 변경 확인
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(getResponse.body.birthDate).toContain('1995-05-05');
  });

  it('다중 필드 변경 시 200 반환', async () => {
    const updateData = {
      name: '복합변경',
      phone_number: '010-7777-9999',
      birth_date: '1992-03-15'
    };

    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData);

    expect(response.status).toBe(200);

    // 변경 확인
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/account')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(getResponse.body.name).toBe('복합변경');
    expect(getResponse.body.phoneNumber).toBe('010-7777-9999');
    expect(getResponse.body.birthDate).toContain('1992-03-15');
  });

  it('인증 토큰 없을 시 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/mypage/account')
      .send({ name: '테스트' });

    expect(response.status).toBe(401);
  });
});
