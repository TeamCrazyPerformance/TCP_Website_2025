import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/members/entities/user.entity';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { UserRole } from '../../src/members/entities/enums/user-role.enum';

describe('GET /api/v1/admin/members (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository;
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
    userRepository = dataSource.getRepository(User);
  });

  afterAll(async () => {
    await dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`);
    await app.close();
  });

  beforeEach(async () => {
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
    const admin = await userRepository.findOneBy({ id: adminRes.body.id });

    // 관리자 권한 부여
    admin.role = UserRole.ADMIN;
    await userRepository.save(admin);

    // 관리자 로그인
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'adminpassword' });
    adminToken = adminLogin.body.access_token;

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

    // 일반 사용자 로그인
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'normaluser', password: 'userpassword' });
    userToken = userLogin.body.access_token;
  });

  it('관리자가 멤버 목록을 성공적으로 조회하면 200 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // admin + normaluser
  });

  it('조회된 멤버 목록에는 필수 필드들이 포함되어야 함', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    const member = res.body[0];
    expect(member).toHaveProperty('id');
    expect(member).toHaveProperty('username');
    expect(member).toHaveProperty('name');
    expect(member).toHaveProperty('student_number');
    expect(member).toHaveProperty('email');
    expect(member).toHaveProperty('role');
    expect(member).toHaveProperty('join_year');
    expect(member).toHaveProperty('education_status');
    expect(member).toHaveProperty('created_at');

    // 민감한 정보는 포함되지 않아야 함
    expect(member).not.toHaveProperty('password');
  });

  it('멤버 목록이 이름순으로 정렬되어 조회됨', async () => {
    // 추가 테스트 사용자 생성
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'zzz_last',
        password: 'password',
        name: 'zzz마지막',
        student_number: '20230010',
        profile_image: '',
        phone_number: '010-0000-0010',
        email: 'zzz@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        tech_stack: [],
        education_status: EducationStatus.Enrolled,
        current_company: '',
        baekjoon_username: 'zzz_last',
        github_username: 'zzz_last',
        self_description: '',
        is_public_github_username: false,
        is_public_email: false,
      });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'aaa_first',
        password: 'password',
        name: 'aaa첫번째',
        student_number: '20230011',
        profile_image: '',
        phone_number: '010-0000-0011',
        email: 'aaa@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        tech_stack: [],
        education_status: EducationStatus.Enrolled,
        current_company: '',
        baekjoon_username: 'aaa_first',
        github_username: 'aaa_first',
        self_description: '',
        is_public_github_username: false,
        is_public_email: false,
      });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    // 이름순 정렬 확인
    for (let i = 0; i < res.body.length - 1; i++) {
      expect(res.body[i].name.localeCompare(res.body[i + 1].name)).toBeLessThanOrEqual(0);
    }
  });

  it('soft delete된 멤버는 목록에 포함되지 않음', async () => {
    // 삭제할 테스트 사용자 생성
    const deleteUserRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: 'deleteduser',
        password: 'password',
        name: '삭제될사용자',
        student_number: '20230020',
        profile_image: '',
        phone_number: '010-0000-0020',
        email: 'deleted@example.com',
        major: '컴퓨터공학과',
        join_year: 2023,
        birth_date: new Date('2000-01-01'),
        gender: UserGender.Male,
        tech_stack: [],
        education_status: EducationStatus.Enrolled,
        current_company: '',
        baekjoon_username: 'deleteduser',
        github_username: 'deleteduser',
        self_description: '',
        is_public_github_username: false,
        is_public_email: false,
      });

    const deleteUserId = deleteUserRes.body.user.id;

    // 삭제 전 목록 조회
    const beforeDeleteRes = await request(app.getHttpServer())
      .get('/api/v1/admin/members')
      .set('Authorization', `Bearer ${adminToken}`);

    const beforeCount = beforeDeleteRes.body.length;

    // DELETE API로 삭제
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/members/${deleteUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // 삭제 후 목록 조회
    const afterDeleteRes = await request(app.getHttpServer())
      .get('/api/v1/admin/members')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(afterDeleteRes.status).toBe(200);
    expect(afterDeleteRes.body.length).toBe(beforeCount - 1);

    // 삭제된 사용자가 목록에 없는지 확인
    const deletedUserInList = afterDeleteRes.body.find(u => u.id === deleteUserId);
    expect(deletedUserInList).toBeUndefined();
  });

  it('관리자가 아닌 사용자가 조회 요청 시 403 반환', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('인증 토큰 없이 요청 시 401 반환', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/members');

    expect(res.status).toBe(401);
  });

  it('등록된 멤버가 없으면 빈 배열을 반환', async () => {
    // 모든 사용자 삭제
    await dataSource.query(`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;`);

    // 관리자만 다시 생성
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

    const admin = await userRepository.findOneBy({ id: adminRes.body.id });
    admin.role = UserRole.ADMIN;
    await userRepository.save(admin);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'adminpassword' });
    const newAdminToken = adminLogin.body.access_token;

    // 관리자만 남기고 모두 삭제
    await dataSource.query(`DELETE FROM "user" WHERE id != ${admin.id};`);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/members')
      .set('Authorization', `Bearer ${newAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1); // 관리자만 남음
  });
});
