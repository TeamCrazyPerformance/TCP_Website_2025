import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { DataSource, Not, IsNull } from 'typeorm';
import { AnnouncementService } from './../src/announcement/announcement.service';
import { User } from './../src/members/entities/user.entity';
import { UserGender } from './../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from './../src/members/entities/enums/education-status.enum';

describe('DELETE /api/v1/announcements/:id (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: AnnouncementService;

  // let adminToken: string;  // Guard 붙으면 사용
  // let userToken: string;   // Guard 붙으면 사용
  let token: string;

  let authorId: number;
  let announcementId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    service = moduleFixture.get(AnnouncementService);

    const userRepo = dataSource.getRepository(User);
    await userRepo.delete({ id: Not(IsNull()) });

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


    // 삭제 대상 공지 생성
    const a = await service.create(
      { title: '삭제 대상', contents: '내용', summary: '내용' },
      authorId,
    );
    announcementId = a.id;

    token = 'your_admin_token_here';
  });

  afterAll(async () => {
    // 삭제 테스트에서 이미 지워졌을 수 있으니 예외 없이 진행
    try {
      if (announcementId) await service.remove(announcementId);
    } catch {}
    if (authorId) {
      const userRepo = dataSource.getRepository(User);
      await userRepo.delete({ id: authorId });
    }
    await app.close();
  });

  it('존재하는 공지 삭제 요청 시 204 반환', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  // Guard 적용 후 아래 테스트 주석 해제
  // it('인증 없이 요청 시 401 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .delete(`/api/v1/announcements/${announcementId}`);
  //   expect(res.status).toBe(401);
  // });

  // it('일반 사용자 계정으로 요청 시 403 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .delete(`/api/v1/announcements/${announcementId}`)
  //     .set('Authorization', `Bearer ${userToken}`);
  //   expect(res.status).toBe(403);
  // });
});
