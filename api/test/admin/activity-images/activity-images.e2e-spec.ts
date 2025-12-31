import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../../src/members/entities/user.entity';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';
import { UserRole } from '../../../src/members/entities/enums/user-role.enum';
import * as fs from 'fs';
import * as path from 'path';

describe('POST /api/v1/admin/activity-images (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository;
  let adminToken: string;
  let userToken: string;

  const basePath = path.join(
    process.cwd(),
    'public',
    'activities',
  );

  const competitionPath = path.join(basePath, 'competition.jpg');
  const studyPath = path.join(basePath, 'study.jpg');
  const mtPath = path.join(basePath, 'mt.jpg');

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    userRepository = dataSource.getRepository(User);

    await dataSource.query(`TRUNCATE TABLE refresh_token, "user" RESTART IDENTITY CASCADE;`);

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

  afterAll(async () => {
    await dataSource.query(`TRUNCATE TABLE refresh_token, "user" RESTART IDENTITY CASCADE;`);
    await app.close();
  });

  beforeEach(() => {
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  });

  afterEach(() => {
    [competitionPath, studyPath, mtPath].forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  it('관리자가 사진 3개를 성공적으로 업로드하면 201 반환', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/activity-images')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach(
        'competition',
        path.join(process.cwd(), 'test/fixtures/competition.png'),
      )
      .attach(
        'study',
        path.join(process.cwd(), 'test/fixtures/study.png'),
      )
      .attach(
        'mt',
        path.join(process.cwd(), 'test/fixtures/mt.png'),
      )
      .expect(201);

    expect(fs.existsSync(competitionPath)).toBe(true);
    expect(fs.existsSync(studyPath)).toBe(true);
    expect(fs.existsSync(mtPath)).toBe(true);
  });

  it('관리자가 특정 사진만 삭제 요청 시 201 반환', async () => {
    // 먼저 업로드
    fs.writeFileSync(competitionPath, Buffer.from('test'));
    fs.writeFileSync(studyPath, Buffer.from('test'));
    fs.writeFileSync(mtPath, Buffer.from('test'));

    await request(app.getHttpServer())
      .post('/api/v1/admin/activity-images')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('removeStudy', 'true')
      .expect(201);

    expect(fs.existsSync(competitionPath)).toBe(true);
    expect(fs.existsSync(studyPath)).toBe(false);
    expect(fs.existsSync(mtPath)).toBe(true);
  });

  it('파일 없이 remove도 없으면 기존 파일을 유지하고 201 반환', async () => {
    fs.writeFileSync(competitionPath, Buffer.from('test'));

    await request(app.getHttpServer())
      .post('/api/v1/admin/activity-images')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(fs.existsSync(competitionPath)).toBe(true);
  });

  it('인증 토큰 없이 요청 시 401 반환', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/activity-images')
      .expect(401);
  });

  it('관리자가 아닌 사용자가 요청 시 403 반환', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/activity-images')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  describe('GET /api/v1/admin/activity-images', () => {
    it('관리자가 이미지 목록 조회 시 200 반환', async () => {
      // Setup: Create dummy files
      if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
      fs.writeFileSync(competitionPath, 'dummy');

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/activity-images')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('competition');
      // study and mt might be null if not created, or strings if they exist.
      // The implementation returns path if exists, null if not.
      expect(res.body.competition).toContain('/activities/competition.jpg');
    });

    it('일반 사용자가 조회 시 403 반환', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/activity-images')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/v1/admin/activity-images/:type', () => {
    it('관리자가 특정 이미지 삭제 시 200 반환', async () => {
      // Setup
      if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
      fs.writeFileSync(competitionPath, 'dummy');

      await request(app.getHttpServer())
        .delete('/api/v1/admin/activity-images/competition')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(fs.existsSync(competitionPath)).toBe(false);
    });

    it('잘못된 타입으로 삭제 요청 시 400 반환', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/admin/activity-images/invalidType')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('일반 사용자가 삭제 요청 시 403 반환', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/admin/activity-images/competition')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
