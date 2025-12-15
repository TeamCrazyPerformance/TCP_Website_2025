import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/members/entities/user.entity';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';
import { Team } from '../../src/teams/entities/team.entity';

describe('DELETE /api/v1/teams/:id (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository;
    let teamRepository;
    let leader: User;
    let leaderToken: string;
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

        await dataSource.query(
            `TRUNCATE TABLE team_member, team_role, team, "user" RESTART IDENTITY CASCADE;`,
        );

        // --- leader 계정 생성 ---
         const leaderRes  = await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    username: 'leader',
                    password: 'leaderpassword',
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
                    self_description: '팀장 유저',
                    is_public_current_company: false,
                    is_public_github_username: false,
                    is_public_baekjoon_username: false,
                    is_public_email: false,
                });

        expect(leaderRes.status).toBe(201);
        leader = await userRepository.findOneBy({ id: leaderRes.body.id });

        // --- notLeader 계정 생성 ---
        const userRes = await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    username: 'user',
                    password: 'userpassword',
                    name: '일반사용자',
                    student_number: '20232222',
                    profile_image: '',
                    phone_number: '010-2222-2222',
                    email: 'user2@example.com',
                    major: '정보통신학과',
                    join_year: 2023,
                    birth_date: new Date('2001-02-02'),
                    gender: UserGender.Female,
                    tech_stack: [],
                    education_status: EducationStatus.Enrolled,
                    current_company: '카카오',
                    baekjoon_username: 'user2',
                    github_username: 'user2',
                    self_description: '일반 유저',
                    is_public_current_company: false,
                    is_public_github_username: false,
                    is_public_baekjoon_username: false,
                    is_public_email: false,
                });

        expect(userRes.status).toBe(201);

        // 로그인
        const leaderLogin = await request(app.getHttpServer())
           .post('/auth/login')
           .send({ username: 'leader', password: 'leaderpassword' });
        leaderToken = leaderLogin.body.access_token;
        
         const userLogin = await request(app.getHttpServer())
           .post('/auth/login')
           .send({ username: 'user', password: 'userpassword' });
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

    it('팀장이 팀을 성공적으로 삭제하면 204 반환', async () => {
        const team = await teamRepository.save({
            title: '삭제 테스트 팀',
            description: '삭제 테스트 설명',
            category: '프로젝트',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'delete@test.com',
            leader: leader,
        });

        const res = await request(app.getHttpServer())
            .delete(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${leaderToken}`);

        expect(res.status).toBe(204);

        const deleted = await teamRepository.findOne({ where: { id: team.id } });
        expect(deleted).toBeNull();
    });

    it('팀장이 아닌 사용자가 삭제 요청 시 403 반환', async () => {
      const team = await teamRepository.save({
        title: '권한 테스트 팀',
        description: '삭제 권한 테스트',
        category: '스터디',
        periodStart: new Date('2025-10-01'),
        periodEnd: new Date('2025-11-01'),
        deadline: new Date('2025-09-30'),
        contact: 'forbidden@test.com',
        leader: leader,
        });

        const res = await request(app.getHttpServer())
            .delete(`/api/v1/teams/${team.id}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
    });

    it('존재하지 않는 팀 ID로 요청 시 404 반환', async () => {
        const res = await request(app.getHttpServer())
            .delete('/api/v1/teams/999')
            .set('Authorization', `Bearer ${leaderToken}`);

        expect(res.status).toBe(404);
    });
});
