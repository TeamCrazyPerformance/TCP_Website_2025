import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { AnnouncementService } from '../../src/announcement/announcement.service';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { UserRole } from '../../src/members/entities/enums/user-role.enum';

describe('DELETE /api/v1/announcements/:id (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: AnnouncementService;
  let adminToken: string;
  let userToken: string;
  let authorId: number;
  let announcementId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    service = moduleFixture.get(AnnouncementService);

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
        education_status: EducationStatus.Enrolled,
      });

    expect(adminRegisterRes.status).toBe(201);
    authorId = adminRegisterRes.body.user.id;

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
        education_status: EducationStatus.Enrolled,
      });

    expect(userRegisterRes.status).toBe(201);

    // 일반 사용자 로그인
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'user1', password: 'userpassword' });
    userToken = userLogin.body.access_token;

    // 삭제 대상 공지 생성
    const a = await service.create(
      { title: '삭제 대상', contents: '내용', summary: '내용' },
      authorId,
    );
    announcementId = a.id;
  });

  afterAll(async () => {
    await dataSource.query(
      `TRUNCATE TABLE announcement, "user" RESTART IDENTITY CASCADE;`
    );
    await app.close();
  });

  it('인증 없이 요청 시 401 반환', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/announcements/${announcementId}`);
    expect(res.status).toBe(401);
  });

  it('일반 사용자 계정으로 요청 시 403 반환', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('존재하는 공지 삭제 요청 시 204 반환', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });
});
