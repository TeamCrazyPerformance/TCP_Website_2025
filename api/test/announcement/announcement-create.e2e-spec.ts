import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { UserRole } from '../../src/members/entities/enums/user-role.enum';

describe('POST /api/v1/announcements (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
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
      `TRUNCATE TABLE announcement, "user" RESTART IDENTITY CASCADE;`
    );

    // 관리자 계정 생성 (회원가입)
    const adminRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'adminuser',
        password: 'adminpassword',
        name: '관리자',
        student_number: '20239998',
        phone_number: '010-8888-8888',
        email: 'admin@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: new Date('2001-01-01'),
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    expect(adminRegisterRes.status).toBe(201);

    // 관리자 계정에 ADMIN 권한 부여 (직접 DB 업데이트)
    const userRepo = dataSource.getRepository('user');
    await userRepo.update(
      { username: 'adminuser' },
      { role: UserRole.ADMIN }
    );

    // 관리자 로그인
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'adminuser', password: 'adminpassword' });
    adminToken = adminLogin.body.access_token;

    // 일반 사용자 계정 생성 (회원가입)
    const userRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'user1',
        password: 'userpassword',
        name: '일반사용자',
        student_number: '20231111',
        phone_number: '010-1111-1111',
        email: 'user@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: new Date('2001-01-01'),
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    expect(userRegisterRes.status).toBe(201);

    // 일반 사용자 로그인
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'user1', password: 'userpassword' });
    userToken = userLogin.body.access_token;
  });

  afterAll(async () => {
    await dataSource.query(
      `TRUNCATE TABLE announcement, "user" RESTART IDENTITY CASCADE;`
    );
    await app.close();
  });

  it('제목, 내용, 텍스트 모두 정상 입력 시 201 반환 (예약 미지정 시 현재 시각)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '공지 제목',
        contents: '공지 본문',
        summary: '공지 텍스트',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('author');
    expect(res.body.author).toHaveProperty('id');
  });

  it('예약 발행 지정 시 201 반환', async () =>{
    const futureDate = new Date(Date.now() + 60*60*1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '예약 공지',
        contents: '본문',
        summary: '요약',
        publishAt: futureDate,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('publishAt');
  });

  it('필드 누락(제목 없음) 시 400 반환', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        // title: '공지 제목', // 누락!
        contents: '공지 본문',
        summary: '공지 텍스트',
      });
      
    expect(res.status).toBe(400);
  });

  it('인증 없이 요청 시 401 반환', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .send({
        title: '공지 제목',
        contents: '공지 본문',
        summary: '공지 텍스트',
      });
    expect(res.status).toBe(401);
  });

  it('권한 없는 사용자 요청 시 403 반환', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: '공지 제목',
        contents: '공지 본문',
        summary: '공지 텍스트',
      });
    expect(res.status).toBe(403);
  });
});
