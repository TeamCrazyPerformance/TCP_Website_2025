import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../members/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { EducationStatus } from '../members/entities/enums/education-status.enum';
import { UserGender } from '../members/entities/enums/user-gender.enum';

type MockRepo<T extends import('typeorm').ObjectLiteral = import('typeorm').ObjectLiteral> = Partial<Record<keyof import('typeorm').Repository<T>, jest.Mock>>;

const mockUsersRepo = (): MockRepo<User> => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockJwtService = () => ({
  signAsync: jest.fn(),
});

const mockConfigService = (values: Record<string, any> = {}) => ({
  get: jest.fn((key: string) => values[key]),
});

describe('AuthService.register', () => {
  let service: AuthService;
  let usersRepo: MockRepo<User>;
  let jwt: ReturnType<typeof mockJwtService>;
  let config: ReturnType<typeof mockConfigService>;

  const baseDto: RegisterDto = {
    username: 'stce01',
    password: 'P@ssword1234',
    name: '홍길동',
    student_number: '20230001',
    phone_number: '010-0000-0000',
    email: 'stce01@example.com',
    major: '컴퓨터공학',
    join_year: 2023,
    birth_date: '2000-01-02',
    gender: UserGender.Male,
    education_status: EducationStatus.Enrolled,
    tech_stack: ['NestJS', 'TypeScript'],
  };

  beforeEach(async () => {
    jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed_pw'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo() },
        { provide: JwtService, useValue: mockJwtService() },
        { provide: ConfigService, useValue: mockConfigService({ BCRYPT_SALT_ROUNDS: 12, JWT_SECRET: 'secret', JWT_EXPIRES_IN: '1d' }) },
      ],
    }).compile();

    service = module.get(AuthService);
    usersRepo = module.get(getRepositoryToken(User));
    jwt = module.get(JwtService);
    config = module.get(ConfigService) as any;

    // 기본 mock 초기화
    usersRepo.findOne!.mockReset();
    usersRepo.create!.mockReset();
    usersRepo.save!.mockReset();
    (jwt.signAsync as jest.Mock).mockReset().mockResolvedValue('signed.jwt.token');
  });

  it('중복 없음 → 해시 후 저장, 토큰 리턴, password 응답에 없음', async () => {
    // 중복검사: 전부 없음
    usersRepo.findOne!
      .mockResolvedValueOnce(null)  // by username
      .mockResolvedValueOnce(null)  // by email
      .mockResolvedValueOnce(null); // by student_number

    const savedUser: User = {
      ...({} as User),
      id: 1,
      username: baseDto.username,
      name: baseDto.name,
      email: baseDto.email,
      student_number: baseDto.student_number,
      profile_image: 'default_profile_image.png',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
      // 나머지 필드 생략
    };

    usersRepo.create!.mockReturnValue({ ...baseDto, password: 'hashed_pw' });
    usersRepo.save!.mockResolvedValue(savedUser);

    const res = await service.register(baseDto);

    expect(bcrypt.hash).toHaveBeenCalledWith(baseDto.password, 12);
    expect(usersRepo.create).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashed_pw' }));
    expect(usersRepo.save).toHaveBeenCalled();

    // JWT 호출 확인
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: savedUser.id, username: savedUser.username },
      expect.objectContaining({ secret: 'secret', expiresIn: '1d' }),
    );

    // 응답 스키마
    expect(res).toEqual({
      user: {
        id: savedUser.id,
        username: savedUser.username,
        name: savedUser.name,
        email: savedUser.email,
        student_number: savedUser.student_number,
        profile_image: savedUser.profile_image,
        created_at: savedUser.created_at,
        updated_at: savedUser.updated_at,
      },
      access_token: 'signed.jwt.token',
    });

    // password는 포함되면 안 됨
    expect((res as any).user.password).toBeUndefined();
  });

  it('username 중복 시 ConflictException', async () => {
    usersRepo.findOne!
      .mockResolvedValueOnce({ id: 77 }) // by username
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(service.register(baseDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('email 중복 시 ConflictException', async () => {
    usersRepo.findOne!
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 88 }) // by email
      .mockResolvedValueOnce(null);

    await expect(service.register(baseDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('student_number 중복 시 ConflictException', async () => {
    usersRepo.findOne!
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 99 }); // by student_number

    await expect(service.register(baseDto)).rejects.toBeInstanceOf(ConflictException);
  });
});
