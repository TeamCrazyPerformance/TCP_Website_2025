import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/members/entities/user.entity';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { UserRole } from '../../src/members/entities/enums/user-role.enum';

describe('PATCH /api/v1/admin/members/:id (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository;
  let admin: User;
  let adminToken: string;
  let normalUser: User;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);

    await dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`);

    // --- 관리자 계정 생성 ---
    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'admin',
        password: 'adminpassword',
        name: '관리자',
        student_number: '20230001',
        profile_image: '',
        phone_number: '010-0000-0001',
        email: 'admin@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        tech_stack: [],
        education_status: EducationStatus.Enrolled,
        current_company: '테스트회사',
        baekjoon_username: 'admin',
        github_username: 'admin',
        self_description: '관리자 계정',
        is_public_github_username: false,
        is_public_email: false,
      });

    expect(adminRes.status).toBe(201);
    admin = await userRepository.findOneBy({ id: adminRes.body.id });

    // 관리자 권한 부여
    admin.role = UserRole.ADMIN;
    await userRepository.save(admin);

    // --- 일반 사용자 계정 생성 ---
    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'normaluser',
        password: 'userpassword',
        name: '일반사용자',
        student_number: '20230002',
        profile_image: '',
        phone_number: '010-0000-0002',
        email: 'user@example.com',
        major: '소프트웨어학과',
        join_year: 2023,
        birth_date: new Date('2001-02-02'),
        gender: UserGender.Female,
        tech_stack: [],
        education_status: EducationStatus.Enrolled,
        current_company: '일반회사',
        baekjoon_username: 'normaluser',
        github_username: 'normaluser',
        self_description: '일반 사용자',
        is_public_github_username: false,
        is_public_email: false,
      });

    expect(userRes.status).toBe(201);
    normalUser = await userRepository.findOneBy({ id: userRes.body.id });

    // 로그인
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'adminpassword' });
    adminToken = adminLogin.body.access_token;

    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'normaluser', password: 'userpassword' });
    userToken = userLogin.body.access_token;
  });

  afterAll(async () => {
    await dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`);
    await app.close();
  });

  it('관리자가 회원 이름을 성공적으로 수정 시 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '수정된이름',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('수정된이름');
  });

  it('관리자가 회원 이메일을 성공적으로 수정 시 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newemail@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('newemail@example.com');
  });

  it('관리자가 회원 정보를 복합적으로 수정 시 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '복합수정이름',
        email: 'complex@example.com',
        phone_number: '010-9999-9999',
        major: '인공지능학과',
        education_status: EducationStatus.Graduated,
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('복합수정이름');
    expect(res.body.email).toBe('complex@example.com');
    expect(res.body.phone_number).toBe('010-9999-9999');
    expect(res.body.major).toBe('인공지능학과');
    expect(res.body.education_status).toBe(EducationStatus.Graduated);
  });

  it('관리자가 아닌 사용자가 수정 요청 시 403 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: '권한없는수정',
      });

    expect(res.status).toBe(403);
  });

  it('존재하지 않는 회원 ID로 수정 요청 시 404 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/admin/members/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '존재하지않는사용자',
      });

    expect(res.status).toBe(404);
  });

  it('잘못된 이메일 형식으로 수정 요청 시 400 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'invalid-email-format',
      });

    expect(res.status).toBe(400);
  });

  it('잘못된 education_status 값으로 수정 요청 시 400 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        education_status: 'INVALID_STATUS',
      });

    expect(res.status).toBe(400);
  });

  it('인증 토큰 없이 요청 시 401 반환', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .send({
        name: '토큰없는수정',
      });

    expect(res.status).toBe(401);
  });

  it('삭제된 회원을 수정 요청 시 404 반환', async () => {
    // 테스트용 회원 생성 및 삭제
    const testUser = await userRepository.save({
      username: 'deleteduser',
      password: 'testpassword',
      name: '삭제된사용자',
      student_number: '20230003',
      profile_image: '',
      phone_number: '010-0000-0003',
      email: 'deleted@example.com',
      major: '전자공학과',
      join_year: 2023,
      birth_date: new Date('2002-03-03'),
      gender: UserGender.Male,
      tech_stack: [],
      education_status: EducationStatus.Enrolled,
      current_company: '',
      baekjoon_username: 'deleteduser',
      github_username: 'deleteduser',
      self_description: '삭제될 사용자',
      is_public_github_username: false,
      is_public_email: false,
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/members/${testUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${testUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '삭제된사용자수정',
      });

    expect(res.status).toBe(404);
  });

  it('빈 body로 요청 시에도 200 반환 (변경사항 없음)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
  });
});
