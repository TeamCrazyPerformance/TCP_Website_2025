import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { DataSource, Not, IsNull } from 'typeorm';
import { AnnouncementService } from './../src/announcement/announcement.service';
import { User } from './../src/members/entities/user.entity';
import { UserGender } from './../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from './../src/members/entities/enums/education-status.enum';

describe('PATCH /api/v1/announcements/:id (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: AnnouncementService;
  // let adminToken: string;
  // let userToken: string;

  let token: string;
  let authorId: number;
  let announcementId1: number; // 업데이트 검증용
  let announcementId2: number; // 빈 바디(no-op) 검증용

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    service = moduleFixture.get(AnnouncementService);

    const userRepo = dataSource.getRepository(User);
    await userRepo.delete({id: Not(IsNull())});

    // const roleRepo = dataSource.getRepository(Role);
    // await roleRepo.delete({id: Not(IsNull())});

    // 관리자 계정 생성
    const adminUser = await userRepo.save({
      username: 'adminuser',
      password: 'adminpassword',
      name: '관리자',
      student_number: '20239998',
      profile_image: '',
      phone_number: '010-8888-8888',
      email: 'admin@example.com',
      major: '컴퓨터공학과',
      join_year: 2023,
      birth_date: new Date('2000-01-01'),
      gender: UserGender.Male,
      tech_stack: ['NestJS', 'TypeORM'],
      education_status: EducationStatus.Enrolled,
      current_company: 'Kakao',
      baekjoon_username: 'adminuser',
      github_username: 'adminuser',
      self_description: '관리자 계정',
      is_public_current_company: false,
      is_public_github_username: false,
      is_public_baekjoon_username: false,
      is_public_email: false,
    });
    // await roleRepo.save({
    //   user_id: adminUser.id,
    //   study_id: null,
    //   role_name: 'Admin',
    // });
    authorId = adminUser.id;

    // // 일반 사용자 계정 생성
    // const normalUser = await userRepo.save({
    //   username: 'user1',
    //   password: 'userpassword',
    //   name: '일반사용자',
    //   student_number: '20231111',
    //   profile_image: '',
    //   phone_number: '010-1111-1111',
    //   email: 'user@example.com',
    //   major: '컴퓨터공학과',
    //   join_year: 2023,
    //   birth_date: new Date('2001-01-01'),
    //   gender: UserGender.Male,
    //   tech_stack: [],
    //   education_status: EducationStatus.Enrolled,
    //   current_company: '네이버',
    //   baekjoon_username: 'user1',
    //   github_username: 'user1',
    //   self_description: '일반 테스트 유저입니다.',
    //   is_public_current_company: false,
    //   is_public_github_username: false,
    //   is_public_baekjoon_username: false,
    //   is_public_email: false,
    // });
    // await roleRepo.save({
    //   user_id: normalUser.id,
    //   study_id: null,
    //   role_name: 'User',
    // });

    // const adminLogin = await request(app.getHttpServer())
    //   .post('/api/login')
    //   .send({ email: 'admin@example.com', password: 'adminpassword' });
    // adminToken = adminLogin.body.accessToken;

    // const userLogin = await request(app.getHttpServer())
    //   .post('/api/login')
    //   .send({ email: 'user@example.com', password: 'userpassword' });
    // userToken = userLogin.body.accessToken;
    

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

    token = 'your_admin_token_here';
  });

  afterAll(async () => {
    if (announcementId1) await service.remove(announcementId1);
    if (announcementId2) await service.remove(announcementId2);
    if (authorId) {
      const userRepo = dataSource.getRepository(User);
      await userRepo.delete({ id: authorId });
    }
    await app.close();
  });

  it('제목과 내용 변경 요청 시 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${announcementId1}`)
      .set('Authorization', `Bearer ${token}`)
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

  it('예약 발행일 수정 시 200 반환', async () =>{
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2시간 뒤
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/announcements/${announcementId1}`)
      .set('Authorization', `Bearer ${token}`)
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
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);

    const after = await request(app.getHttpServer())
        .get(`/api/v1/announcements/${announcementId2}`);

    expect(after.status).toBe(200);
    expect(after.body.title).toBe(prevTitle);
    expect(after.body.contents).toBe(prevContents);
  });

  // Guard 적용 후 아래 테스트 주석 해제
  // it('인증 없이 요청 시 401 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .patch(`/api/v1/announcements/${announcementId1}`)
  //     .send({ title: 'x' });
  //   expect(res.status).toBe(401);
  // });
  //
  // it('권한 없는 사용자 요청 시 403 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .patch(`/api/v1/announcements/${announcementId1}`)
  //     .set('Authorization', `Bearer ${userToken}`)
  //     .send({ title: 'x' });
  //   expect(res.status).toBe(403);
  // });
});
