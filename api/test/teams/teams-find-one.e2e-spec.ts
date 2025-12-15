import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { Team } from '../../src/teams/entities/team.entity';


describe('GET /api/v1/teams/:id (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let teamRepository: any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    
        dataSource = moduleFixture.get(DataSource);
        teamRepository = dataSource.getRepository(Team);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // 각 테스트가 독립적인 환경에서 실행되도록, 기존 데이터를 모두 삭제합니다.
        await dataSource.query(`TRUNCATE TABLE team, team_role, team_member RESTART IDENTITY CASCADE;`);
    });

    it('팀이 존재할 시 200 반환', async () => {
        const team = teamRepository.create({ 
        title: '테스트 팀',
        description: '상세 조회 테스트',
        category: '프로젝트',
        periodStart: new Date('2025-10-01'),
        periodEnd: new Date('2025-11-01'),
        deadline: new Date('2025-09-30'),
        contact: 'test-contact@example.com'
        });
        const savedTeam = await teamRepository.save(team);
  
        const res = await request(app.getHttpServer()).get(`/api/v1/teams/${savedTeam.id}`);
  
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(savedTeam.id);
        expect(res.body.title).toBe(savedTeam.title);
    });

    it('팀이 존재하지 않을 시 404 반환', async () => {
        const nonExistentId = 9999;
        const res = await request(app.getHttpServer()).get(`/api/v1/teams/${nonExistentId}`);
  
        expect(res.status).toBe(404);
    });
});
