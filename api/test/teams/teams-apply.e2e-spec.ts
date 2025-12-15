import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/members/entities/user.entity';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { Team } from '../../src/teams/entities/team.entity';
import { TeamRole } from '../../src/teams/entities/team-role.entity';

describe('POST /api/v1/teams/:id/apply (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository;
    let teamRepository;
    let roleRepository;
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
        teamRepository = dataSource.getRepository(Team);
        roleRepository = dataSource.getRepository(TeamRole);

        await dataSource.query(
            `TRUNCATE TABLE team_member, team_role, team, "user" RESTART IDENTITY CASCADE;`,
        );

        // --- 유저 생성 ---
        const applicantRes = await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    username: 'applicant',
                    password: 'password',
                    name: '지원자',
                    student_number: '20231111',
                    profile_image: '',
                    phone_number: '010-1111-1111',
                    email: 'applicant@example.com',
                    major: '컴퓨터공학과',
                    join_year: 2023,
                    birth_date: new Date('2000-01-01'),
                    gender: UserGender.Male,
                    tech_stack: [],
                    education_status: EducationStatus.Enrolled,
                    current_company: '네이버',
                    baekjoon_username: 'applicant',
                    github_username: 'applicant',
                    self_description: '테스트 지원자',
                    is_public_current_company: false,
                    is_public_github_username: false,
                    is_public_baekjoon_username: false,
                    is_public_email: false,
                });

        expect(applicantRes.status).toBe(201);

        // 로그인
        const userLogin = await request(app.getHttpServer())
           .post('/auth/login')
           .send({ username: 'applicant', password: 'password' });
        userToken = userLogin.body.access_token;
    });

    afterAll(async () => {
        await dataSource.query(
            `TRUNCATE TABLE team_member, team_role, team, "user" RESTART IDENTITY CASCADE;`,
        );
        await app.close();
    });

    beforeEach(async () => {
        await dataSource.query(
        `TRUNCATE TABLE team_member, team_role, team RESTART IDENTITY CASCADE;`,
        );
    });

    it('정상적으로 팀에 지원하면 201 반환', async () => {
        const team = await teamRepository.save({
            title: '지원 테스트 팀',
            description: '지원 정상 케이스',
            category: '프로젝트',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'apply@test.com',
        });

        const role = await roleRepository.save({
        team: team,
        roleName: 'Backend',
        recruitCount: 2,
        currentCount: 0,
        });

        const res = await request(app.getHttpServer())
            .post(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ roleId: role.id });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.user).toBeDefined();
        expect(res.body.team).toBeDefined();
        expect(res.body.role.id).toBe(role.id);
    });

    it('존재하지 않는 팀에 지원 시 404 반환', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/teams/999/apply')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ roleId: 1 });

        expect(res.status).toBe(404);
    });

    it('존재하지 않는 역할(roleId)로 지원 시 404 반환', async () => {
        const team = await teamRepository.save({
            title: '역할 없음 팀',
            description: '역할 없음 케이스',
            category: '스터디',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'norole@test.com',
        });

        const res = await request(app.getHttpServer())
            .post(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ roleId: 999 });

        expect(res.status).toBe(404);
    });

    it('중복 지원 시 400 반환', async () => {
     const team = await teamRepository.save({
        title: '중복 지원 팀',
        description: '중복 케이스',
        category: '프로젝트',
        periodStart: new Date('2025-10-01'),
        periodEnd: new Date('2025-11-01'),
        deadline: new Date('2025-09-30'),
        contact: 'duplicate@test.com',
        });

        const role = await roleRepository.save({
        team: team,
        roleName: 'Frontend',
        recruitCount: 1,
        currentCount: 0,
        });

        // 첫 지원
        await request(app.getHttpServer())
            .post(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ roleId: role.id });

        // 두 번째 지원 (중복)
        const res = await request(app.getHttpServer())
            .post(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ roleId: role.id });

        expect(res.status).toBe(400);
    });
});
