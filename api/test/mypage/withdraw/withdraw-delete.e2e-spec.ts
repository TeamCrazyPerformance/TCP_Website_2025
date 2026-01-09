import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';

describe('DELETE /api/v1/mypage/withdraw (e2e)', () => {
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

  it('정상 탈퇴 시 200 반환 및 소프트 삭제 확인', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/v1/mypage/withdraw')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    
    // 소프트 삭제 확인 - deleted_at이 설정되었는지 확인
    const userCheck = await dataSource.query(
      `SELECT id, username, deleted_at FROM "user" WHERE username = 'testuser'`
    );
    
    expect(userCheck).toHaveLength(1);
    expect(userCheck[0].deleted_at).not.toBeNull();
    expect(new Date(userCheck[0].deleted_at)).toBeInstanceOf(Date);
  });

  it('탈퇴 후 로그인 및 API 접근 불가 확인', async () => {
    // 탈퇴 실행
    await request(app.getHttpServer())
      .delete('/api/v1/mypage/withdraw')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // 탈퇴 후 다른 API 접근 시도
    const profileResponse = await request(app.getHttpServer())
      .get('/api/v1/mypage/profile')
      .set('Authorization', `Bearer ${userToken}`);

    // 소프트 삭제된 사용자의 토큰은 더 이상 사용할 수 없음
    expect(profileResponse.status).toBe(401);
  });

  it('인증 토큰 없을 시 401 반환', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/v1/mypage/withdraw');

    expect(response.status).toBe(401);
  });

  it('이미 삭제된 사용자 탈퇴 시도 시 401 반환', async () => {
    // 첫 번째 탈퇴
    await request(app.getHttpServer())
      .delete('/api/v1/mypage/withdraw')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // 두 번째 탈퇴 시도 - 소프트 삭제된 사용자의 토큰은 무효
    const response = await request(app.getHttpServer())
      .delete('/api/v1/mypage/withdraw')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(401);
  });
});
