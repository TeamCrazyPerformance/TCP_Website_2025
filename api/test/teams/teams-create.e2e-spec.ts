import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';

describe('POST /api/v1/teams (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let token: string;
    let createdUserId: number;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        await app.init();

        dataSource = moduleFixture.get(DataSource);
       
        await dataSource.query(
            `TRUNCATE TABLE team_member, team_role, team, "user" RESTART IDENTITY CASCADE;`
        );

        // --- 일반 사용자 계정 생성(회원가입) ---
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'user1',
                password: 'userpassword',
                name: '일반사용자',
                student_number: '20231111',
                profile_image: '',
                phone_number: '010-1111-1111',
                email: 'user@example.com',
                major: '컴퓨터공학과',
                join_year: 2023,
                birth_date: new Date('2001-01-01'),
                gender: UserGender.Male,
                tech_stack: [],
                education_status: EducationStatus.Enrolled,
                current_company: '네이버',
                baekjoon_username: 'user1',
                github_username: 'user1',
                self_description: '일반 테스트 유저입니다.',
                is_public_current_company: false,
                is_public_github_username: false,
                is_public_baekjoon_username: false,
                is_public_email: false,
            });

        expect(registerRes.status).toBe(201);
        createdUserId = registerRes.body.user.id;

        // 로그인
        const userLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ username: 'user1', password: 'userpassword' });

        token = userLogin.body.access_token;
    });

    afterAll(async () => {
        await dataSource.query(
            `TRUNCATE TABLE team_member, team_role, team, "user" RESTART IDENTITY CASCADE;`
        );
        await app.close();
    });


    it('모든 필수 필드 정상 입력 시 201 반환', async () => {
        const res = await request(app.getHttpServer())
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${token}`)
        .send({
            title: '생성 테스트 팀',
            description: '팀 생성 테스트 설명',
            category: '프로젝트',
            periodStart: '2025-10-01',
            periodEnd: '2025-11-01',
            deadline: '2025-09-30',
            contact: 'create@test.com',
            roles: [
                { roleName: 'Backend', recruitCount: 2 },
                { roleName: 'Frontend', recruitCount: 1 },
            ],
        });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.title).toBe('생성 테스트 팀');
        expect(res.body.roles.length).toBe(2);

        // leader.id와 user.id가 같은지 검증
        expect(res.body.leader).toBeDefined();
        expect(res.body.leader.id).toBe(createdUserId);
    });

    it('필수 필드 누락 시 400 반환', async () => {
        const res = await request(app.getHttpServer())
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${token}`)
        .send({
            // title 누락
            description: '제목 없음',
            category: '스터디',
            periodStart: '2025-10-01',
            periodEnd: '2025-11-01',
            deadline: '2025-09-30',
            contact: 'fail@test.com',
            roles: [{ roleName: 'Backend', recruitCount: 2 }],
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toBeDefined();
    });

    it('역할(roles)이 누락되었을 때 400 반환', async () => {
        const res = await request(app.getHttpServer())
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${token}`)
        .send({
            title: 'roles 없음',
            description: 'roles 누락',
            category: '스터디',
            periodStart: '2025-10-01',
            periodEnd: '2025-11-01',
            deadline: '2025-09-30',
            contact: 'fail@test.com',
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('At least one role is required');
    });

    it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer())
        .post('/api/v1/teams')
        .send({
            title: '인증 없음',
            description: '권한 체크',
            category: '스터디',
            periodStart: '2025-10-01',
            periodEnd: '2025-11-01',
            deadline: '2025-09-30',
            contact: 'noauth@test.com',
            roles: [{ roleName: 'Backend', recruitCount: 2 }],
        });

        expect(res.status).toBe(401);
    });
});
