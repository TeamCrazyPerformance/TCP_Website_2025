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
import { TeamMember } from '../../src/teams/entities/team-member.entity';

describe('DELETE /api/v1/teams/:id/apply (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userRepository;
    let teamRepository;
    let roleRepository;
    let memberRepository;
    let leader: User;
    let applicant: User;
    let leaderToken: string;
    let applicantToken: string;

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
        memberRepository = dataSource.getRepository(TeamMember);

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

        // --- applicant 계정 생성 ---
        const applicantRes = await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    username: 'applicant',
                    password: 'password',
                    name: '지원자',
                    student_number: '20232222',
                    profile_image: '',
                    phone_number: '010-2222-2222',
                    email: 'applicant@example.com',
                    major: '정보통신학과',
                    join_year: 2023,
                    birth_date: new Date('2001-02-02'),
                    gender: UserGender.Female,
                    tech_stack: [],
                    education_status: EducationStatus.Enrolled,
                    current_company: '카카오',
                    baekjoon_username: 'applicant',
                    github_username: 'applicant',
                    self_description: '지원자 유저',
                    is_public_current_company: false,
                    is_public_github_username: false,
                    is_public_baekjoon_username: false,
                    is_public_email: false,
                });

        expect(applicantRes.status).toBe(201);
        applicant = await userRepository.findOneBy({ id: applicantRes.body.id });

        // 로그인
        const leaderLogin = await request(app.getHttpServer())
           .post('/auth/login')
           .send({ username: 'leader', password: 'leaderpassword' });
        leaderToken = leaderLogin.body.access_token;
        
        const userLogin = await request(app.getHttpServer())
           .post('/auth/login')
           .send({ username: 'applicant', password: 'password' });
        applicantToken = userLogin.body.access_token;
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

    it('정상적으로 지원 취소 시 200 반환', async () => {
        const team = await teamRepository.save({
            title: '취소 테스트 팀',
            description: '정상 취소 케이스',
            category: '프로젝트',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'cancel@test.com',
            leader: leader,
        });

        const role = await roleRepository.save({
            team,
            roleName: 'Backend',
            recruitCount: 2,
            currentCount: 0,
        });

        // 먼저 지원
        await request(app.getHttpServer())
            .post(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${applicantToken}`)
            .send({ roleId: role.id })
            .expect(201);

        // 취소 요청
        const res = await request(app.getHttpServer())
            .delete(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${applicantToken}`);

        expect(res.status).toBe(200);

        // DB 확인
        const member = await memberRepository.findOne({
            where: { user: { id: applicant.id }, team: { id: team.id } },
        });
        expect(member).toBeNull();
    });

    it('지원 내역이 없으면 404 반환', async () => {
        const team = await teamRepository.save({
            title: '지원 내역 없음 팀',
            description: '404 케이스',
            category: '스터디',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'nofound@test.com',
            leader: leader,
        });

        const res = await request(app.getHttpServer())
            .delete(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${applicantToken}`);

        expect(res.status).toBe(404);
    });

    it('리더가 지원 취소 시도 시 403 반환', async () => {
        const team = await teamRepository.save({
            title: '리더 취소 불가 팀',
            description: '403 케이스',
            category: '프로젝트',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'leadercancel@test.com',
            leader: leader,
        });

        await memberRepository.save({
            user: leader,
            team,
            role: null,
            isLeader: true,
        });

        const res = await request(app.getHttpServer())
            .delete(`/api/v1/teams/${team.id}/apply`)
            .set('Authorization', `Bearer ${leaderToken}`);

        expect(res.status).toBe(403);
    });
});
