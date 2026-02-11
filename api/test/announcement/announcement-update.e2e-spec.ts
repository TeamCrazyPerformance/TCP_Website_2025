import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { AnnouncementService } from '../../src/announcement/announcement.service';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { UserRole } from '../../src/members/entities/enums/user-role.enum';

describe('PATCH /api/v1/announcements/:id (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: AnnouncementService;
  let adminToken: string;
  let userToken: string;
  let authorId: string;
  let announcementId1: number; // 업데이트 검증용
  let announcementId2: number; // 빈 바디(no-op) 검증용

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
      .post('/api/v1/auth/register')
      .send({
        username: 'adminuser',
        password: 'AdminPassword123!',
        name: '관리자',
        student_number: '20239998',
        phone_number: '010-8888-8888',
        email: 'admin@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: '2001-01-01',
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
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
      .post('/api/v1/auth/login')
      .send({ username: 'adminuser', password: 'AdminPassword123!' });
    adminToken = adminLogin.body.access_token;

    // 일반 사용자 계정 생성 (회원가입)
    const userRegisterRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        username: 'user1',
        password: 'UserPassword123!',
        name: '일반사용자',
        student_number: '20231111',
        phone_number: '010-1111-1111',
        email: 'user@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: '2001-01-01',
        gender: UserGender.Male,
        education_status: EducationStatus.Enrolled
      });

    expect(userRegisterRes.status).toBe(201);

    // 일반 사용자 로그인
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'user1', password: 'UserPassword123!' });
    userToken = userLogin.body.access_token;

    // 테스트용 공지 2개 생성
    const a1 = await service.create(
      { title: '원래 제목 1', contents: '원래 본문 1', summary: '원래 본문 1' },
      authorId,
    );
    const a2 = await service.create(
      { title: '원래 제목 2', contents: '원래 본문 2', summary: '원래 본문 2' },
      authorId,
    );
    announcementId1 = a1.id;
    announcementId2 = a2.id;
  });

  afterAll(async () => {
    await dataSource.query(
      `TRUNCATE TABLE announcement, "user" RESTART IDENTITY CASCADE;`
    );
    
    // DataSource 연결 닫기
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    
    await app.close();
  });

  it('제목과 내용 변경 요청 시 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${announcementId1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '수정된 제목',
        contents: '수정된 본문',
        summary: '수정된 본문',
      });
    expect(res.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/announcements/${announcementId1}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('수정된 제목');
    expect(getRes.body.contents).toBe('수정된 본문');
  });

  it('예약 발행일 수정 시 200 반환', async () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2시간 뒤
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${announcementId1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ publishAt: futureDate });

    expect(res.status).toBe(200);
    expect(new Date(res.body.publishAt).toISOString()).toBe(futureDate);
  });

  it('아무 필드도 보내지 않음 → 200(업데이트 없음)', async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/announcements/${announcementId2}`);
    expect(before.status).toBe(200);
    const { title: prevTitle, contents: prevContents } = before.body;

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${announcementId2}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/announcements/${announcementId2}`);

    expect(after.status).toBe(200);
    expect(after.body.title).toBe(prevTitle);
    expect(after.body.contents).toBe(prevContents);
  });

  it('인증 없이 요청 시 401 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${announcementId1}`)
      .send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('권한 없는 사용자 요청 시 403 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${announcementId1}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'x' });
    expect(res.status).toBe(403);
  });
});
