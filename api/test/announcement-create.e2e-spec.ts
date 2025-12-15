import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { User } from './../src/members/entities/user.entity';
import { UserGender } from './../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from './../src/members/entities/enums/education-status.enum';
import { Not, IsNull } from 'typeorm';

describe('POST /api/announcements (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  // let adminToken: string;
  // let userToken: string;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    const userRepo = dataSource.getRepository(User);
    await userRepo.delete({id: Not(IsNull())});

    // const roleRepo = dataSource.getRepository(Role);
    // await roleRepo.delete({id: Not(IsNull())});

    // // 관리자 계정 생성
    // const adminUser = await userRepo.save({
    //   username: 'adminuser',
    //   password: 'adminpassword',
    //   name: '관리자',
    //   student_number: '20239998',
    //   profile_image: '',
    //   phone_number: '010-8888-8888',
    //   email: 'admin@example.com',
    //   major: '컴퓨터공학과',
    //   join_year: 2023,
    //   birth_date: nete('2000-01-01'),
    //   gender: UserGender.Male,
    //   tech_stack: ['NestJS', 'TypeORM'],
    //   education_status: EducationStatus.Enrolled,
    //   current_company: 'Kakao',
    //   baekjoon_username: 'adminuser',
    //   github_username: 'adminuser',
    //   self_description: '관리자 계정',
    //   is_public_current_company: false,
    //   is_public_github_username: false,
    //   is_public_baekjoon_username: false,
    //   is_public_email: false,
    // });
    // await roleRepo.save({
    //   user_id: adminUser.id,
    //   study_id: null,
    //   role_name: 'Admin',
    // });

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
    token = 'your_admin_token_here';
  });

  afterAll(async () => {
    await app.close();
  });

  it('제목, 내용, 텍스트 모두 정상 입력 시 201 반환 (예약 미지정 시 현재 시각)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '공지 제목',
        contents: '공지 본문',
        summary: '공지 텍스트',
      });

    expect(res.status).toBe(201);
  });

  it('예약 발행 지정 시 201 반환', async () =>{
    const futureDate = new Date(Date.now() + 60*60*1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
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
      .set('Authorization', `Bearer ${token}`)
      .send({
        // title: '공지 제목', // 누락!
        contents: '공지 본문',
        summary: '공지 텍스트',
      });
      
    expect(res.status).toBe(400);
  });

  // Guard 적용 후 아래 테스트 주석 해제
  // it('인증 없이 요청 시 401 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .post('/api/v1/announcements')
  //     .send({
  //       title: '공지 제목',
  //       contents: '공지 본문',
  //       summary: '공지 텍스트',
  //     });
  //   expect(res.status).toBe(401);
  // });

  // it('권한 없는 사용자 요청 시 403 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .post('/api/v1/announcements')
  //     .set('Authorization', `Bearer ${userToken}`)
  //     .send({
  //       title: '공지 제목',
  //       contents: '공지 본문',
  //       summary: '공지 텍스트',
  //     });
  //   expect(res.status).toBe(403);
  // });
});
