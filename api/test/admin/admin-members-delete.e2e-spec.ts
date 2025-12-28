import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/members/entities/user.entity';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { UserRole } from '../../src/members/entities/enums/user-role.enum';

describe('DELETE /api/v1/admin/members/:id (e2e)', () => {
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

  it('관리자가 회원을 성공적으로 삭제하면 204 반환', async () => {
    // 삭제할 테스트 회원 생성
    const testUser = await userRepository.save({
      username: 'deletetest',
      password: 'testpassword',
      name: '삭제테스트',
      student_number: '20230003',
      profile_image: '',
      phone_number: '010-0000-0003',
      email: 'delete@example.com',
      major: '전자공학과',
      join_year: 2023,
      birth_date: new Date('2002-03-03'),
      gender: UserGender.Male,
      tech_stack: [],
      education_status: EducationStatus.Enrolled,
      current_company: '',
      baekjoon_username: 'deletetest',
      github_username: 'deletetest',
      self_description: '삭제 테스트용 사용자',
      is_public_github_username: false,
      is_public_email: false,
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/members/${testUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Soft delete 확인 - deleted_at이 설정되었는지 확인
    const deleted = await userRepository.findOne({
      where: { id: testUser.id },
      withDeleted: true,
    });
    expect(deleted).not.toBeNull();
    expect(deleted.deleted_at).not.toBeNull();
  });

  it('관리자가 아닌 사용자가 삭제 요청 시 403 반환', async () => {
    // 삭제할 테스트 회원 생성
    const testUser = await userRepository.save({
      username: 'forbiddentest',
      password: 'testpassword',
      name: '권한테스트',
      student_number: '20230004',
      profile_image: '',
      phone_number: '010-0000-0004',
      email: 'forbidden@example.com',
      major: '정보통신학과',
      join_year: 2023,
      birth_date: new Date('2003-04-04'),
      gender: UserGender.Female,
      tech_stack: [],
      education_status: EducationStatus.Enrolled,
      current_company: '',
      baekjoon_username: 'forbiddentest',
      github_username: 'forbiddentest',
      self_description: '권한 테스트용 사용자',
      is_public_github_username: false,
      is_public_email: false,
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/members/${testUser.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('존재하지 않는 회원 ID로 요청 시 404 반환', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/v1/admin/members/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('이미 삭제된 회원을 다시 삭제 요청 시 404 반환', async () => {
    // 삭제할 테스트 회원 생성
    const testUser = await userRepository.save({
      username: 'doubletest',
      password: 'testpassword',
      name: '중복삭제테스트',
      student_number: '20230005',
      profile_image: '',
      phone_number: '010-0000-0005',
      email: 'double@example.com',
      major: '컴퓨터공학과',
      join_year: 2023,
      birth_date: new Date('2004-05-05'),
      gender: UserGender.Male,
      tech_stack: [],
      education_status: EducationStatus.Enrolled,
      current_company: '',
      baekjoon_username: 'doubletest',
      github_username: 'doubletest',
      self_description: '중복 삭제 테스트용 사용자',
      is_public_github_username: false,
      is_public_email: false,
    });

    // 첫 번째 삭제
    const firstRes = await request(app.getHttpServer())
      .delete(`/api/v1/admin/members/${testUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(firstRes.status).toBe(200);

    // 두 번째 삭제 시도
    const secondRes = await request(app.getHttpServer())
      .delete(`/api/v1/admin/members/${testUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(secondRes.status).toBe(404);
  });

  it('인증 토큰 없이 요청 시 401 반환', async () => {
    const res = await request(app.getHttpServer()).delete(
      `/api/v1/admin/members/${normalUser.id}`,
    );

    expect(res.status).toBe(401);
  });
});
