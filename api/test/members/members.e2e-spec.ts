import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { MembersService } from '../../src/members/members.service';
import { Repository } from 'typeorm';
import { User } from '../../src/members/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserGender } from '../../src/members/entities/enums/user-gender.enum';
import { EducationStatus } from '../../src/members/entities/enums/education-status.enum';

describe('MembersController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // 실제 전체 앱 로딩
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    await userRepository.query(`DELETE FROM "user";`);
    jest.restoreAllMocks();
    await app.close();
  });

  it('정상 요청 시 200 상태 코드와 멤버 리스트 반환', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/members');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  }); 

  it('이메일 공개 여부가 true일 때 200 상태 코드와 email 필드 포함된 멤버 리스트 반환', async () => {
    await userRepository.save({
      username: 'test2',
      password: '1234',
      name: '이순신',
      student_number: '20250002',
      profile_image: '',
      phone_number: '010-3333-4444',
      email: 'test2@example.com',
      major: 'CS',
      join_year: 2025,
      birth_date: new Date('2000-02-02'),
      gender: UserGender.Male,
      education_status: EducationStatus.Enrolled,
      is_public_email: false,
    });

    const response = await request(app.getHttpServer()).get('/api/v1/members');

    expect(response.status).toBe(200);
    expect(response.body[0].email).toBe('test1@example.com');
  });

  it('이메일 공개 여부가 false일 때 200 상태 코드와 email 필드가 제외된 멤버 리스트 반환', async () => {
    await userRepository.save({
      username: 'test2',
      password: '1234',
      name: '이순신',
      student_number: '20250002',
      profile_image: 'img.png',
      phone_number: '010-3333-4444',
      email: 'test2@example.com',
      major: 'CS',
      join_year: 2025,
      birth_date: new Date('2000-02-02'),
      gender: UserGender.Male,
      education_status: EducationStatus.Enrolled,
      is_public_email: false,
    });

    const response = await request(app.getHttpServer()).get('/api/v1/members');

    expect(response.status).toBe(200);
    expect(response.body[1].email).toBeUndefined();
  });

  it('서비스 내부 예외 시 500 반환', async () => {
    const service = app.get(MembersService); // 실제 서비스 DI로 가져오기
  
    // 서비스 메서드를 강제로 예외를 발생시키도록 mocking
    jest.spyOn(service, 'getPublicMemberList').mockImplementation(() => {
      throw new Error('Internal Error!');
    });
    
    const response = await request(app.getHttpServer()).get('/api/v1/members');
    expect(response.status).toBe(500);
  });
});
