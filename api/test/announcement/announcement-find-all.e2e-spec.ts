import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { Announcement } from '../../src/announcement/entities/announcement.entity';
import { User } from '../../src/members/entities/user.entity';

describe('GET /api/v1/announcements (e2e)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let announcementRepository: any;
    let userRepository: any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    
        dataSource = moduleFixture.get(DataSource);
        announcementRepository = dataSource.getRepository(Announcement);
        userRepository = dataSource.getRepository(User);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // TRUNCATE TABLE에 CASCADE 옵션을 사용하여 관련된 모든 데이터를 삭제
        await dataSource.query(`TRUNCATE TABLE announcement, "user" RESTART IDENTITY CASCADE;`);
    });

    it('게시일이 지난 모든 공지사항 목록을 성공적으로 반환', async () => {
        // 테스트용 유저 생성
        const user = userRepository.create({
            username: 'testadmin3',
            password: 'hashedpassword123',
            name: '테스트 관리자',
            student_number: '20250003',
            phone_number: '010-1234-5678',
            email: 'admin3@test.com',
            major: '컴퓨터공학과',
            join_year: 2025,
            birth_date: new Date('2000-01-01'),
            role: 'ADMIN',
        });
        await userRepository.save(user);

        // 게시일이 지난 공지사항 2개 생성
        const now = new Date();
        const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1일 전

        const announcement1 = announcementRepository.create({ 
            title: '공지사항 1',
            contents: '테스트 공지사항 1 내용',
            summary: '테스트 요약 1',
            publishAt: pastDate,
            views: 0,
            author: user,
        });
        const announcement2 = announcementRepository.create({ 
            title: '공지사항 2',
            contents: '테스트 공지사항 2 내용',
            summary: '테스트 요약 2',
            publishAt: pastDate,
            views: 5,
            author: user,
        });
        await announcementRepository.save([announcement1, announcement2]);
  
        const res = await request(app.getHttpServer()).get('/api/v1/announcements');
  
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(2);
    });

    it('등록된 공지사항이 없으면 빈 배열을 반환', async () => {
        const response = await request(app.getHttpServer()).get('/api/v1/announcements');
  
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(0);
    });

    it('게시일이 지나지 않은 공지사항은 반환하지 않음', async () => {
        // 테스트용 유저 생성
        const user = userRepository.create({
            username: 'testadmin3',
            password: 'hashedpassword123',
            name: '테스트 관리자',
            student_number: '20250003',
            phone_number: '010-1234-5678',
            email: 'admin3@test.com',
            major: '컴퓨터공학과',
            join_year: 2025,
            birth_date: new Date('2000-01-01'),
            role: 'ADMIN',
        });
        await userRepository.save(user);

        // 게시일이 미래인 공지사항 생성
        const now = new Date();
        const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1일 후

        const announcement = announcementRepository.create({ 
            title: '미래 공지사항',
            contents: '아직 게시되지 않은 공지사항',
            summary: '미래 요약',
            publishAt: futureDate,
            views: 0,
            author: user,
        });
        await announcementRepository.save(announcement);

        const response = await request(app.getHttpServer()).get('/api/v1/announcements');

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(0);
    });
});
