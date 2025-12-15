import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { Team } from '../../src/teams/entities/team.entity';

describe('GET /api/v1/teams (e2e)', () => {
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
        // TRUNCATE TABLE에 CASCADE 옵션을 사용하여 관련된 모든 데이터를 삭제
        await dataSource.query(`TRUNCATE TABLE team_member, team_role, team RESTART IDENTITY CASCADE;`);

    });

    it('팀 모집글 목록을 성공적으로 반환', async () => {
        const team1 = teamRepository.create({ 
            title: '팀1',
            description: '테스트 팀1 설명',
            category: '프로젝트',
            periodStart: new Date('2025-10-01'),
            periodEnd: new Date('2025-11-01'),
            deadline: new Date('2025-09-30'),
            contact: 'test-contact1@example.com'
        });
        const team2 = teamRepository.create({ 
            title: '팀2',
            description: '테스트 팀2 설명',
            category: '스터디',
            periodStart: new Date('2025-10-15'),
            periodEnd: new Date('2025-12-01'),
            deadline: new Date('2025-10-14'),
            contact: 'test-contact2@example.com'
        });
        await teamRepository.save([team1, team2]);
  
        const res = await request(app.getHttpServer()).get('/api/v1/teams');
  
        
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(2);
    });

  it('등록된 팀 모집글이 없으면 빈 배열을 반환', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/teams');
  
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(0);
  });
});
