import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { User } from './../src/members/entities/user.entity';
import { UserGender } from './../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from './../src/members/entities/enums/education-status.enum';
import { Not, IsNull } from 'typeorm';

describe('PATCH /api/v1/admin/members/:id (E2E)', () => {
  let app: INestApplication;
  // let adminToken: string;
  // let userToken: string;
  let token: string;
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    const dataSource = moduleFixture.get(DataSource);
    const userRepo = dataSource.getRepository(User);
    await userRepo.delete({id: Not(IsNull())});

    // const roleRepo = dataSource.getRepository(Role);
    // await roleRepo.delete({ id: Not(IsNull()) });

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
    //   birth_date: new Date('2000-01-01'),
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

    const normalUser  = await userRepo.save({
      username: 'hong1234',
      password: 'password1234',
      name: '홍길동',
      student_number: '20231234',
      profile_image: '',
      phone_number: '010-1234-5678',
      email: 'hong@example.com',
      major: '컴퓨터공학과',
      join_year: 2023,
      birth_date: new Date('2000-01-01'),
      gender: UserGender.Male,
      tech_stack: ['NestJS'],
      education_status: EducationStatus.Enrolled,
      current_company: 'NAVER',
      baekjoon_username: 'hong123',
      github_username: 'honggit',
      self_description: '업데이트 테스트용 유저입니다.',
      is_public_current_company: false,
      is_public_github_username: false,
      is_public_baekjoon_username: false,
      is_public_email: false,
    });
    userId = normalUser.id;

    // const basicUser = await userRepo.save({
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
    //   user_id: basicUser.id,
    //   study_id: null,
    //   role_name: 'User',
    // });


    // const adminLoginRes = await request(app.getHttpServer())
    //   .post('/api/login')
    //   .send({ email: 'admin@example.com', password: 'adminpassword' });
    // adminToken = adminLoginRes.body.accessToken;

    // const userLoginRes = await request(app.getHttpServer())
    //   .post('/api/login')
    //   .send({ email: 'user@example.com', password: 'userpassword' });
    // userToken = userLoginRes.body.accessToken;

    token = 'your_admin_token_here'; 
  });

  afterAll(async () => {
    await app.close();
  });

  it('정상 수정 요청 시 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'newemail@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('newemail@example.com');
  });

  it('존재하지 않는 ID면 404 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/99999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(404);
  });

  it('이메일 형식이 잘못되면 400 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

//  it('인증 없이 요청하면 401 반환', async () => {
//    const res = await request(app.getHttpServer())
//      .patch(`/api/v1/admin/members/${userId}`)
//      .send({ email: 'test@example.com' });
//
//    expect(res.status).toBe(401);
//  });
//
//  it('권한 없는 사용자 요청 시 403 반환 (가드 적용 시)', async () => {
//    const res = await request(app.getHttpServer())
//      .patch(`/api/v1/admin/members/${userId}`)
//      .set('Authorization', `Bearer ${userToken}`)
//      .send({ email: 'test@example.com' });
//
//    expect(res.status).toBe(403);
//  });
});
