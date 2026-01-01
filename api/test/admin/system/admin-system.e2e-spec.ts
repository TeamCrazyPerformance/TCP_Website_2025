import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../../src/members/entities/user.entity';
import { UserRole } from '../../../src/members/entities/enums/user-role.enum';
import { UserGender } from '../../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../../src/members/entities/enums/education-status.enum';
import { AdminSystemService } from '../../../src/admin/system/admin-system.service';

describe('Admin System API (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository;
    let adminToken: string;
    let userToken: string;

    // Mock Service to prevent process.exit()
    const mockAdminSystemService = {
        getSystemStats: jest.fn().mockResolvedValue({
            cpu: { usagePercentage: 10 },
            memory: { usagePercentage: 50 },
            disk: { usagePercentage: 20 },
            uptime: 100,
        }),
        restartServer: jest.fn().mockReturnValue({ message: 'Server is restarting... (Mock)' }),
        shutdownServer: jest.fn().mockReturnValue({ message: 'Server is shutting down... (Mock)' }),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(AdminSystemService)
            .useValue(mockAdminSystemService)
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        await app.init();

        dataSource = moduleFixture.get(DataSource);
        userRepository = dataSource.getRepository(User);

        await dataSource.query(`TRUNCATE TABLE refresh_token, "user" RESTART IDENTITY CASCADE;`);

        // --- Create Admin Account ---
        const adminRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'admin_sys',
                password: 'adminpassword',
                name: '관리자',
                student_number: '99990001',
                profile_image: '',
                phone_number: '010-9999-0001',
                email: 'adminsys@example.com',
                major: 'Computer Science',
                join_year: 2023,
                birth_date: new Date('2000-01-01'),
                gender: UserGender.Male,
                tech_stack: [],
                education_status: EducationStatus.Enrolled,
                current_company: 'Test Company',
                baekjoon_username: 'adminsys',
                github_username: 'adminsys',
                self_description: 'Admin for system test',
                is_public_github_username: false,
                is_public_email: false,
            });

        const admin = await userRepository.findOneBy({ id: adminRes.body.id });
        admin.role = UserRole.ADMIN;
        await userRepository.save(admin);

        const adminLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ username: 'admin_sys', password: 'adminpassword' });
        adminToken = adminLogin.body.access_token;

        // --- Create Normal User Account ---
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'user_sys',
                password: 'userpassword',
                name: '사용자',
                student_number: '99990002',
                profile_image: '',
                phone_number: '010-9999-0002',
                email: 'usersys@example.com',
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
            .send({ username: 'user_sys', password: 'userpassword' });
        userToken = userLogin.body.access_token;
    });

    afterAll(async () => {
        await dataSource.query(`TRUNCATE TABLE refresh_token, "user" RESTART IDENTITY CASCADE;`);
        await app.close();
    });

    describe('GET /api/v1/admin/system/stats', () => {
        it('Admin can retrieve system stats (200 OK)', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/admin/system/stats')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('cpu');
            expect(res.body).toHaveProperty('memory');
            expect(mockAdminSystemService.getSystemStats).toHaveBeenCalled();
        });

        it('Normal user cannot retrieve system stats (403 Forbidden)', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/admin/system/stats')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);
        });

        it('Unauthorized request returns 401', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/admin/system/stats')
                .expect(401);
        });
    });

    describe('POST /api/v1/admin/system/:action', () => {
        it('Admin can restart server (Mocked)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/admin/system/restart')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(201);

            expect(res.body.message).toContain('Server is restarting');
            expect(mockAdminSystemService.restartServer).toHaveBeenCalled();
        });

        it('Admin can shutdown server (Mocked)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/admin/system/shutdown')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(201);

            expect(res.body.message).toContain('Server is shutting down');
            expect(mockAdminSystemService.shutdownServer).toHaveBeenCalled();
        });

        it('Invalid action returns 400 Bad Request', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/admin/system/invalid')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(400);
        });

        it('Normal user cannot control server (403 Forbidden)', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/admin/system/restart')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);
        });
    });
});
