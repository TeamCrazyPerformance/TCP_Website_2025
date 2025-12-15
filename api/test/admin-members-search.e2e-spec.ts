import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { User } from './../src/members/entities/user.entity';
import { UserGender } from './../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from './../src/members/entities/enums/education-status.enum';
import { Not, IsNull } from 'typeorm';

describe('GET /api/v1/admin/members/search (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  // let adminToken: string;  //  로그인/권한 구현시 사용
  // let userToken: string;   //  로그인/권한 구현시 사용
  let token: string;          //  로그인/권한 구현X, 임시 사용
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    const userRepo = dataSource.getRepository(User);
    await userRepo.delete({ id: Not(IsNull()) });

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

    

    const normalUser = await userRepo.save({
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
      tech_stack: ['NestJS', 'TypeORM'],
      education_status: EducationStatus.Enrolled,
      current_company: 'NAVER',
      baekjoon_username: 'hong123',
      github_username: 'honggit',
      self_description: '안녕하세요',
      is_public_current_company: false,
      is_public_github_username: false,
      is_public_baekjoon_username: false,
      is_public_email: false,
    });

    // await roleRepo.save({
    //   user_id: normalUser.id,
    //   study_id: null,
    //   role_name: 'User',
    // });

    // //관리자 로그인 → 토큰 발급
    // const adminLoginRes = await request(app.getHttpServer())
    //   .post('/api/login')
    //   .send({ email: 'admin@example.com', password: 'adminpassword' });
    // adminToken = adminLoginRes.body.accessToken;
 
    // //일반 사용자 로그인 → 토큰 발급
    // const userLoginRes = await request(app.getHttpServer())
    //   .post('/api/login')
    //   .send({ email: 'hong@example.com', password: 'password1234' });
    // userToken = userLoginRes.body.accessToken;

    token = 'your_admin_token_here'; //  로그인/권한 구현X, 임시 사용
  });

  afterAll(async () => {
    await app.close();
  });

  it('정상 검색 시 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members/search?type=name&word=홍')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('존재하지 않는 사용자 검색 시 200 + 빈 배열 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members/search?type=name&word=없는사람')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('비어 있는 검색어는 400 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members/search?type=name&word=')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('type 파라미터 누락 시 400 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members/search?word=홍')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('허용되지 않은 type이면 400 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members/search?type=unknown&word=홍')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  // Guard 적용 후 아래 테스트 주석 해제
  // it('인증 없이 접근 시 401 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .get('/api/v1/admin/members/search?type=name&word=홍')
  //   expect(res.status).toBe(401);
  // });

  // it('관리자 권한 없는 사용자 요청 시 403 반환', async () => {
  //   const res = await request(app.getHttpServer())
  //     .get('/api/v1/admin/members/search?type=name&word=홍')
  //     .set('Authorization', 'Bearer ${userToken}');
  //   expect(res.status).toBe(403);
  // });
});
