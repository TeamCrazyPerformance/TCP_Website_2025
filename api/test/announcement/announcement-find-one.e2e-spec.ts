import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { Announcement } from '../../src/announcement/entities/announcement.entity';
import { User } from '../../src/members/entities/user.entity';


describe('GET /api/v1/announcements/:id (e2e)', () => {
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
        // 각 테스트가 독립적인 환경에서 실행되도록, 기존 데이터를 모두 삭제합니다.
        await dataSource.query(`TRUNCATE TABLE announcement, "user" RESTART IDENTITY CASCADE;`);
    });

    it('공지사항이 존재할 시 200 반환', async () => {
        // 테스트용 유저 생성
        const user = userRepository.create({
            username: 'testadmin',
            password: 'hashedpassword123',
            name: '테스트 관리자',
            student_number: '20250001',
            phone_number: '010-1234-5678',
            email: 'admin@test.com',
            major: '컴퓨터공학과',
            join_year: 2025,
            birth_date: new Date('2000-01-01'),
            role: 'ADMIN',
        });
        await userRepository.save(user);

        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1일 전
        const announcement = announcementRepository.create({ 
            title: '테스트 공지사항',
            contents: '상세 조회 테스트 내용',
            summary: '테스트 요약',
            publishAt: pastDate,
            views: 0,
            author: user,
        });
        const savedAnnouncement = await announcementRepository.save(announcement);
  
        const res = await request(app.getHttpServer()).get(`/api/v1/announcements/${savedAnnouncement.id}`);
  
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(savedAnnouncement.id);
        expect(res.body.title).toBe(savedAnnouncement.title);
    });

    it('조회시 조회수가 증가', async () => {
        // 테스트용 유저 생성
        const user = userRepository.create({
            username: 'testadmin2',
            password: 'hashedpassword123',
            name: '테스트 관리자',
            student_number: '20250002',
            phone_number: '010-1234-5678',
            email: 'admin2@test.com',
            major: '컴퓨터공학과',
            join_year: 2025,
            birth_date: new Date('2000-01-01'),
            role: 'ADMIN',
        });
        await userRepository.save(user);

        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1일 전
        const announcement = announcementRepository.create({ 
            title: '조회수 테스트',
            contents: '조회수 증가 확인',
            summary: '테스트 요약',
            publishAt: pastDate,
            views: 5,
            author: user,
        });
        const savedAnnouncement = await announcementRepository.save(announcement);

        const res = await request(app.getHttpServer()).get(`/api/v1/announcements/${savedAnnouncement.id}`);

        expect(res.status).toBe(200);
        expect(res.body.views).toBe(6); // 조회수가 5에서 6으로 증가

        // DB에서 직접 조회하여 조회수 증가 확인
        const updatedAnnouncement = await announcementRepository.findOne({ 
            where: { id: savedAnnouncement.id } 
        });
        expect(updatedAnnouncement.views).toBe(6);
    });

    it('존재하지 않는 ID로 요청시 404 반환', async () => {
        const nonExistentId = 9999;
        const res = await request(app.getHttpServer()).get(`/api/v1/announcements/${nonExistentId}`);
  
        expect(res.status).toBe(404);
    });

    it('publishAt이 미래인 공지사항 조회시 404 반환', async () => {
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

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1일 후
        const announcement = announcementRepository.create({ 
            title: '미래 공지사항',
            contents: '아직 게시되지 않은 공지',
            summary: '미래 요약',
            publishAt: futureDate,
            views: 0,
            author: user,
        });
        const savedAnnouncement = await announcementRepository.save(announcement);

        const res = await request(app.getHttpServer()).get(`/api/v1/announcements/${savedAnnouncement.id}`);

        expect(res.status).toBe(404);
    });
});
