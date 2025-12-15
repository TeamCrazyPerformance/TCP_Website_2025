import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/members/entities/user.entity';
import { Team } from '../../src/teams/entities/team.entity';
import { TeamRole } from '../../src/teams/entities/team-role.entity';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';

describe('PATCH /api/v1/teams/:id (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository, teamRepository, roleRepository;
    let leader: User;
    let leaderToken: string;
    let userToken: string;
    let team: Team;

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

        // --- 리더 계정 생성 ---
        const leaderRes  = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'leader',
                password: 'password',
                name: '팀장',
                student_number: '20231111',
                profile_image: '',
                phone_number: '010-1111-1111',
                email: 'leader@example.com',
                major: '컴퓨터공학과',
                join_year: 2023,
                birth_date: new Date('2000-01-01'),
                gender: UserGender.Male,
                tech_stack: [],
                education_status: EducationStatus.Enrolled,
                current_company: '네이버',
                baekjoon_username: 'leader',
                github_username: 'leader',
                self_description: '테스트 팀장',
                is_public_current_company: false,
                is_public_github_username: false,
                is_public_baekjoon_username: false,
                is_public_email: false,
            });

        expect(leaderRes.status).toBe(201);
        leader = await userRepository.findOneBy({ id: leaderRes.body.id });

        // --- 일반 사용자 계정 생성 ---
        const userRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: 'user',
                password: 'password',
                name: '일반유저',
                student_number: '20232222',
                profile_image: '',
                phone_number: '010-2222-2222',
                email: 'user2@example.com',
                major: '컴퓨터공학과',
                join_year: 2023,
                birth_date: new Date('2002-02-02'),
                gender: UserGender.Female,
                tech_stack: [],
                education_status: EducationStatus.Enrolled,
                current_company: '카카오',
                baekjoon_username: 'user2',
                github_username: 'user2',
                self_description: '테스트 유저',
                is_public_current_company: false,
                is_public_github_username: false,
                is_public_baekjoon_username: false,
                is_public_email: false,
            });

        expect(userRes.status).toBe(201);

        // 로그인
        const leaderLogin = await request(app.getHttpServer())
           .post('/auth/login')
           .send({ username: 'leader', password: 'password' });
        leaderToken = leaderLogin.body.access_token;
        
        const userLogin = await request(app.getHttpServer())
           .post('/auth/login')
           .send({ username: 'user', password: 'password' });
        userToken = userLogin.body.access_token;

        
    });

    afterAll(async () => {
        await dataSource.query(
            `TRUNCATE TABLE team_member, team_role, team, "user" RESTART IDENTITY CASCADE;`
        );
        await app.close();
    });

    beforeEach(async () => {
        await dataSource.query(
        `TRUNCATE TABLE team_member, team_role, team RESTART IDENTITY CASCADE;`,
        );

        // 기본 팀과 역할 생성
        team = teamRepository.create({
            title: '원본 팀',
            description: '원본 설명',
            category: '프로젝트',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'contact@test.com',
            leader: leader,
        });
        await teamRepository.save(team);

        const role1 = roleRepository.create({
            team,
            roleName: 'Backend',
            recruitCount: 2,
            currentCount: 0,
        });
        const role2 = roleRepository.create({
            team,
            roleName: 'Frontend',
            recruitCount: 1,
            currentCount: 0,
        });
        await roleRepository.save([role1, role2]);

    });

    it('팀장이 기본 정보 수정 시 200 반환', async () => {
        const res = await request(app.getHttpServer())
            .patch(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${leaderToken}`)
            .send({
                title: '수정된 팀',
                description: '수정된 설명',
                contact: 'new-contact@test.com',
            });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('수정된 팀');
        expect(res.body.description).toBe('수정된 설명');
        expect(res.body.contact).toBe('new-contact@test.com');
    });

    it('팀장이 역할을 성공적으로 수정 시 200 반환', async () => {
        const role = await roleRepository.findOneBy({ roleName: 'Backend' });

        const res = await request(app.getHttpServer())
            .patch(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${leaderToken}`)
            .send({
                rolesToUpdate: [{ id: role.id, roleName: 'Server', recruitCount: 3 }],
            });

        expect(res.status).toBe(200);
        const updatedRole = res.body.roles.find(r => r.id === role.id);
        expect(updatedRole.roleName).toBe('Server');
        expect(updatedRole.recruitCount).toBe(3);
    });

    it('팀장이 새로운 역할을 성공적으로 추가 시 200 반환', async () => {
        const res = await request(app.getHttpServer())
            .patch(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${leaderToken}`)
            .send({
                rolesToAdd: [{ roleName: 'Designer', recruitCount: 1 }],
            });

        expect(res.status).toBe(200);
        expect(res.body.roles.some(r => r.roleName === 'Designer')).toBe(true);
    });

    it('팀장이 기존 역할을 성공적으로 삭제 시 200 반환', async () => {
        const role = await roleRepository.findOneBy({ roleName: 'Frontend' });

        const res = await request(app.getHttpServer())
            .patch(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${leaderToken}`)
            .send({
            rolesToUpdate: [{ id: role.id, action: 'delete' }],
        });

        expect(res.status).toBe(200);
        expect(res.body.roles.some(r => r.id === role.id)).toBe(false);
    });

    it('팀장이 아닐 시 403 반환', async () => {
        const res = await request(app.getHttpServer())
            .patch(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ title: '권한 없는 수정' });

        expect(res.status).toBe(403);
    });

    it('중복된 역할 이름 수정 시 409 반환', async () => {
        const role = await roleRepository.findOneBy({ roleName: 'Backend' });

        const res = await request(app.getHttpServer())
            .patch(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${leaderToken}`)
            .send({
            rolesToUpdate: [{ id: role.id, roleName: 'Frontend' }],
        });

        expect(res.status).toBe(409);
    });
});
