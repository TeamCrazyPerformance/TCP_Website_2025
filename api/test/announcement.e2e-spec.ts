import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { AnnouncementService } from './../src/announcement/announcement.service';
import { User } from './../src/members/entities/user.entity';
import { UserGender } from './../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from './../src/members/entities/enums/education-status.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './../src/announcement/entities/announcement.entity';

describe('Announcement API (e2e)',() =>{
    let app: INestApplication;
    let service: AnnouncementService;
    let userRepo: Repository<User>;
    let author: User;
    let announcementId: number;
    let announcementRepo: Repository<Announcement>;

    beforeAll(async () =>{
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule]
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        
        service = app.get(AnnouncementService);
        userRepo = app.get(getRepositoryToken(User));
        announcementRepo = app.get(getRepositoryToken(Announcement));

        // 1. 테스트용 author(유저) 생성
        author = await userRepo.save({
            username: 'testuser',
            password: 'password123', 
            name: '테스트유저',
            student_number: '20231234',
            profile_image: '',
            phone_number: '010-1234-5678',
            email: 'test@example.com',
            major: '컴퓨터공학과',
            join_year: 2022,
            birth_date: new Date('2000-01-01'),
            gender: UserGender.Male,
            tech_stack: ['NestJS', 'TypeORM'],
            education_status: EducationStatus.Enrolled,
            current_company: 'seoultech',
            baekjoon_username: 'baekjoon_test',
            github_username: 'github_test',
            is_public_current_company: false,
            is_public_github_username: false,
            is_public_baekjoon_username: false,
            is_public_email: false,
        });

        // 2. 테스트용 공지사항 생성
        const announcement = await service.create(
            {
            title: '테스트 공지',
            contents: '본문 내용',
            summary: '본문 내용',
            },
            author.id,
        );
        announcementId = announcement.id;
    });

    afterAll(async () => {
        if(announcementId){
            await service.remove(announcementId);
        }
        if (author) {
            await userRepo.delete({ id: author.id });
        }

        jest.restoreAllMocks();
        await app.close();
    });

    describe('GET /api/v1/announcements', () => {
        it('공지사항이 존재하는 경우 200과 함께 목록 반환', async () =>{
            const res = await request(app.getHttpServer())
                .get('/api/v1/announcements');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('서비스 내부 예외 시 500 반환', async () =>{
            jest.spyOn(service, 'findAll').mockImplementation(() => {
                throw new Error('Internal Error!');
            });

            const res = await request(app.getHttpServer())
                .get('/api/v1/announcements');
            
            expect(res.status).toBe(500);

            jest.restoreAllMocks();
        });
    });

    describe('GET /api/v1/announcements/:id', () => {
        it('존재하는 공지사항 ID로 요청 시 200과 함께 객체 반환', async () => {
            const res = await request(app.getHttpServer())
                .get(`/api/v1/announcements/${announcementId}`);
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('id', announcementId);
            expect(res.body).toHaveProperty('title', '테스트 공지');
        });

        it('조회 시 조회수 1 증가', async () =>{
            const before = await announcementRepo.findOneBy({ id: announcementId });
            expect(before).not.toBeNull();

            await request(app.getHttpServer())
                .get(`/api/v1/announcements/${announcementId}`);

            const after = await announcementRepo.findOneBy({ id: announcementId });
            expect(after).not.toBeNull();

            expect(after!.views).toBe(before!.views+1);
        })

        it('존재하지 않는 ID 요청 시 404 반환', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/v1/announcements/99999999');
            
            expect(res.status).toBe(404);
        });

        it('서비스 내부 예외 시 500 반환', async () => {
            jest.spyOn(service, 'findOne').mockImplementation(() => {
                throw new Error('Internal Error!');
            });

            const res = await request(app.getHttpServer())
                .get(`/api/v1/announcements/${announcementId}`);
                
            expect(res.status).toBe(500);
            jest.restoreAllMocks();
        });

        it('publishAt이 미래인 경우 조회 시 404 반환', async () => {
            const futureAnnouncement = await service.create(
                {
                  title: '예약 공지',
                  contents: '본문',
                  summary: '요약',
                  publishAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), 
                },
                author.id,
              );
          
            const res = await request(app.getHttpServer())
                .get(`/api/v1/announcements/${futureAnnouncement.id}`);
          
            expect(res.status).toBe(404);
            await service.remove(futureAnnouncement.id);
        });
    });
});
