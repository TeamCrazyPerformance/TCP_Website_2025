import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../../src/members/entities/user.entity';
import { UserRole } from '../../../src/members/entities/enums/user-role.enum';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';
import { RecruitmentSettings } from '../../../src/recruitment/entities/recruitment-settings.entity';

describe('Recruitment Settings API (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository;
    let settingsRepository;
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
        settingsRepository = dataSource.getRepository(RecruitmentSettings);

        await dataSource.query(`TRUNCATE TABLE refresh_token, "user", recruitment_settings RESTART IDENTITY CASCADE;`);

        // --- Create Admin Account ---
        const adminRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'admin_recruit',
                password: 'adminpassword',
                name: '관리자',
                student_number: '99990001',
                profile_image: '',
                phone_number: '010-9999-0001',
                email: 'adminrecruit@example.com',
                major: 'Computer Science',
                join_year: 2023,
                birth_date: new Date('2000-01-01'),
                gender: UserGender.Male,
                tech_stack: [],
                education_status: EducationStatus.Enrolled,
                current_company: 'Test Company',
                baekjoon_username: 'adminrecruit',
                github_username: 'adminrecruit',
                self_description: 'Admin for recruitment test',
                is_public_github_username: false,
                is_public_email: false,
            });

        const admin = await userRepository.findOneBy({ id: adminRes.body.id });
        admin.role = UserRole.ADMIN;
        await userRepository.save(admin);

        const adminLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ username: 'admin_recruit', password: 'adminpassword' });
        adminToken = adminLogin.body.access_token;

        // --- Create Normal User Account ---
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'user_recruit',
                password: 'userpassword',
                name: '사용자',
                student_number: '99990002',
                profile_image: '',
                phone_number: '010-9999-0002',
                email: 'userrecruit@example.com',
                major: 'Computer Science',
                join_year: 2023,
                birth_date: new Date('2000-01-01'),
                gender: UserGender.Female,
                tech_stack: [],
                education_status: EducationStatus.Enrolled,
                current_company: null,
                baekjoon_username: null,
                github_username: null,
                self_description: 'Normal user',
            });

        const userLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ username: 'user_recruit', password: 'userpassword' });
        userToken = userLogin.body.access_token;
    });

    afterAll(async () => {
        await dataSource.query(`TRUNCATE TABLE refresh_token, "user", recruitment_settings RESTART IDENTITY CASCADE;`);
        await app.close();
    });

    beforeEach(async () => {
        // 각 테스트 전 설정 초기화
        await settingsRepository.clear();
    });

    describe('GET /api/v1/admin/recruitment/settings', () => {
        it('Admin can get settings (creates default if none exist)', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('isApplicationEnabled', false);
            expect(res.body).toHaveProperty('autoEnableOnStart', false);
            expect(res.body).toHaveProperty('autoDisableOnEnd', false);
        });

        it('Normal user cannot get admin settings (403)', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);
        });

        it('Unauthorized request returns 401', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/admin/recruitment/settings')
                .expect(401);
        });
    });

    describe('PATCH /api/v1/admin/recruitment/settings', () => {
        it('Admin can update settings', async () => {
            const startDate = '2026-01-01T00:00:00.000Z';
            const endDate = '2026-01-31T23:59:59.000Z';

            const res = await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    startDate,
                    endDate,
                    isApplicationEnabled: true,
                    autoEnableOnStart: true,
                    autoDisableOnEnd: true,
                })
                .expect(200);

            expect(res.body.isApplicationEnabled).toBe(true);
            expect(res.body.autoEnableOnStart).toBe(true);
            expect(res.body.autoDisableOnEnd).toBe(true);
            expect(new Date(res.body.startDate).toISOString()).toBe(startDate);
            expect(new Date(res.body.endDate).toISOString()).toBe(endDate);
        });

        it('Admin can clear dates by setting null', async () => {
            // 먼저 날짜 설정
            await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ startDate: '2026-01-01T00:00:00.000Z' });

            // null로 설정
            const res = await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ startDate: null })
                .expect(200);

            expect(res.body.startDate).toBeNull();
        });

        it('Normal user cannot update settings (403)', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ isApplicationEnabled: true })
                .expect(403);
        });
    });

    describe('POST /api/v1/admin/recruitment/start-now', () => {
        it('Admin can start recruitment immediately', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/admin/recruitment/start-now')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('시작');

            // 상태 확인
            const statusRes = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(statusRes.body.isApplicationEnabled).toBe(true);
        });

        it('Normal user cannot start recruitment (403)', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/admin/recruitment/start-now')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);
        });
    });

    describe('POST /api/v1/admin/recruitment/stop-now', () => {
        it('Admin can stop recruitment immediately', async () => {
            // 먼저 시작
            await request(app.getHttpServer())
                .post('/api/v1/admin/recruitment/start-now')
                .set('Authorization', `Bearer ${adminToken}`);

            // 중단
            const res = await request(app.getHttpServer())
                .post('/api/v1/admin/recruitment/stop-now')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('중단');

            // 상태 확인
            const statusRes = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(statusRes.body.isApplicationEnabled).toBe(false);
        });
    });

    describe('GET /api/v1/recruitment/status (Public)', () => {
        it('Anyone can get recruitment status without auth', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(res.body).toHaveProperty('isApplicationEnabled');
            expect(res.body).toHaveProperty('startDate');
            expect(res.body).toHaveProperty('endDate');
        });

        it('Returns correct status after admin updates', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    isApplicationEnabled: true,
                    startDate: '2026-01-01T00:00:00.000Z',
                    endDate: '2026-01-31T23:59:59.000Z',
                });

            const res = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(res.body.isApplicationEnabled).toBe(true);
            expect(res.body.startDate).not.toBeNull();
            expect(res.body.endDate).not.toBeNull();
        });
    });
});
