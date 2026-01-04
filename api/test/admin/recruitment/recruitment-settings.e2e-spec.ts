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
        await settingsRepository.clear();
    });

    describe('GET /api/v1/admin/recruitment/settings', () => {
        it('Admin can get settings (creates default if none exist)', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('is_application_enabled', false);
            expect(res.body).toHaveProperty('auto_enable_on_start', false);
            expect(res.body).toHaveProperty('auto_disable_on_end', false);
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
            const start_date = '2026-01-01T00:00:00.000Z';
            const end_date = '2026-01-31T23:59:59.000Z';

            const res = await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    start_date,
                    end_date,
                    is_application_enabled: true,
                    auto_enable_on_start: true,
                    auto_disable_on_end: true,
                })
                .expect(200);

            expect(res.body.is_application_enabled).toBe(true);
            expect(res.body.auto_enable_on_start).toBe(true);
            expect(res.body.auto_disable_on_end).toBe(true);
            expect(new Date(res.body.start_date).toISOString()).toBe(start_date);
            expect(new Date(res.body.end_date).toISOString()).toBe(end_date);
        });

        it('Admin can clear dates by setting null', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ start_date: '2026-01-01T00:00:00.000Z' });

            const res = await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ start_date: null })
                .expect(200);

            expect(res.body.start_date).toBeNull();
        });

        it('Normal user cannot update settings (403)', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ is_application_enabled: true })
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

            const statusRes = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(statusRes.body.is_application_enabled).toBe(true);
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
            await request(app.getHttpServer())
                .post('/api/v1/admin/recruitment/start-now')
                .set('Authorization', `Bearer ${adminToken}`);

            const res = await request(app.getHttpServer())
                .post('/api/v1/admin/recruitment/stop-now')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('중단');

            const statusRes = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(statusRes.body.is_application_enabled).toBe(false);
        });
    });

    describe('GET /api/v1/recruitment/status (Public)', () => {
        it('Anyone can get recruitment status without auth', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(res.body).toHaveProperty('is_application_enabled');
            expect(res.body).toHaveProperty('start_date');
            expect(res.body).toHaveProperty('end_date');
        });

        it('Returns correct status after admin updates', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/admin/recruitment/settings')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    is_application_enabled: true,
                    start_date: '2026-01-01T00:00:00.000Z',
                    end_date: '2026-01-31T23:59:59.000Z',
                });

            const res = await request(app.getHttpServer())
                .get('/api/v1/recruitment/status')
                .expect(200);

            expect(res.body.is_application_enabled).toBe(true);
            expect(res.body.start_date).not.toBeNull();
            expect(res.body.end_date).not.toBeNull();
        });
    });
});
