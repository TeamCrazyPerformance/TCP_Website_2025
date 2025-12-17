import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../members/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { EducationStatus } from '../members/entities/enums/education-status.enum';
import { UserGender } from '../members/entities/enums/user-gender.enum';
import { UserRole } from '../members/entities/enums/user-role.enum';

type MockRepo<T extends import('typeorm').ObjectLiteral = import('typeorm').ObjectLiteral> = Partial<Record<keyof import('typeorm').Repository<T>, jest.Mock>>;

const createMockQueryBuilder = (result: any = null) => ({
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
});

const mockUsersRepo = (): MockRepo<User> & { queryBuilder: ReturnType<typeof createMockQueryBuilder> } => {
  const queryBuilder = createMockQueryBuilder();
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    queryBuilder,
  };
};

const mockJwtService = () => ({
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
});

const mockConfigService = (values: Record<string, any> = {}) => ({
  get: jest.fn((key: string) => values[key]),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: ReturnType<typeof mockUsersRepo>;
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

  const savedUser: User = {
    id: 1,
    username: 'stce01',
    name: '홍길동',
    email: 'stce01@example.com',
    student_number: '20230001',
    profile_image: 'default_profile_image.png',
    role: UserRole.GUEST,
    refresh_token: 'stored.refresh.token',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  } as User;

  beforeEach(async () => {
    jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed_pw'));
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    const repoInstance = mockUsersRepo();
    const jwtInstance = mockJwtService();
    const configInstance = mockConfigService({ BCRYPT_SALT_ROUNDS: 12, JWT_SECRET: 'secret' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repoInstance },
        { provide: JwtService, useValue: jwtInstance },
        { provide: ConfigService, useValue: configInstance },
      ],
    }).compile();

    service = module.get(AuthService);
    usersRepo = repoInstance;
    jwt = jwtInstance;
    config = configInstance;

    // 기본 mock 초기화
    usersRepo.findOne!.mockReset();
    usersRepo.create!.mockReset();
    usersRepo.save!.mockReset();
    usersRepo.update!.mockReset().mockResolvedValue({ affected: 1 });
    (jwt.signAsync as jest.Mock).mockReset().mockResolvedValue('signed.jwt.token');
    (jwt.verifyAsync as jest.Mock).mockReset();
  });

  describe('register', () => {
    it('중복 없음 → 해시 후 저장, access_token + refresh_token 리턴, role 포함', async () => {
      usersRepo.findOne!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      usersRepo.create!.mockReturnValue({ ...baseDto, password: 'hashed_pw' });
      usersRepo.save!.mockResolvedValue(savedUser);

      const res = await service.register(baseDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(baseDto.password, 12);
      expect(usersRepo.create).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashed_pw' }));
      expect(usersRepo.save).toHaveBeenCalled();

      // JWT 호출 확인 (access + refresh 두 번)
      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: savedUser.id, username: savedUser.username, role: savedUser.role },
        expect.objectContaining({ secret: 'secret', expiresIn: '15m' }),
      );
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: savedUser.id, type: 'refresh' },
        expect.objectContaining({ secret: 'secret', expiresIn: '7d' }),
      );

      // refresh_token DB 저장 확인
      expect(usersRepo.update).toHaveBeenCalledWith(savedUser.id, { refresh_token: 'signed.jwt.token' });

      // 응답 스키마
      expect(res).toEqual({
        user: expect.objectContaining({
          id: savedUser.id,
          username: savedUser.username,
          role: savedUser.role,
        }),
        access_token: 'signed.jwt.token',
        refresh_token: 'signed.jwt.token',
      });

      expect((res as any).user.password).toBeUndefined();
    });

    it('username 중복 시 ConflictException', async () => {
      usersRepo.findOne!
        .mockResolvedValueOnce({ id: 77 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.register(baseDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('email 중복 시 ConflictException', async () => {
      usersRepo.findOne!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 88 })
        .mockResolvedValueOnce(null);

      await expect(service.register(baseDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('student_number 중복 시 ConflictException', async () => {
      usersRepo.findOne!
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 99 });

      await expect(service.register(baseDto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('올바른 자격증명 → access_token + refresh_token 리턴', async () => {
      const userWithPassword = { ...savedUser, password: 'hashed_pw' };
      usersRepo.queryBuilder.getOne.mockResolvedValue(userWithPassword);

      const res = await service.login({ username: 'stce01', password: 'P@ssword1234' });

      expect(bcrypt.compare).toHaveBeenCalledWith('P@ssword1234', 'hashed_pw');
      expect(res).toEqual({
        user: expect.objectContaining({ id: savedUser.id, role: savedUser.role }),
        access_token: 'signed.jwt.token',
        refresh_token: 'signed.jwt.token',
      });
    });

    it('존재하지 않는 사용자 → UnauthorizedException', async () => {
      usersRepo.queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.login({ username: 'unknown', password: 'pw' }))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('잘못된 비밀번호 → UnauthorizedException', async () => {
      usersRepo.queryBuilder.getOne.mockResolvedValue({ ...savedUser, password: 'hashed_pw' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login({ username: 'stce01', password: 'wrongpw' }))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('유효한 refresh_token → 새 토큰 발급', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, type: 'refresh' });
      usersRepo.queryBuilder.getOne.mockResolvedValue(savedUser);

      const res = await service.refresh('stored.refresh.token');

      expect(jwt.verifyAsync).toHaveBeenCalledWith('stored.refresh.token', { secret: 'secret' });
      expect(res).toEqual({
        user: expect.objectContaining({ id: savedUser.id }),
        access_token: 'signed.jwt.token',
        refresh_token: 'signed.jwt.token',
      });
    });

    it('DB에 저장된 token과 불일치 → UnauthorizedException', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, type: 'refresh' });
      usersRepo.queryBuilder.getOne.mockResolvedValue({ ...savedUser, refresh_token: 'different.token' });

      await expect(service.refresh('stored.refresh.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('만료된 refresh_token → UnauthorizedException', async () => {
      (jwt.verifyAsync as jest.Mock).mockRejectedValue(new Error('jwt expired'));

      await expect(service.refresh('expired.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('access_token으로 refresh 시도 → UnauthorizedException', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, username: 'stce01', role: 'GUEST' });

      await expect(service.refresh('access.token.here'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('로그아웃된 사용자의 refresh_token → UnauthorizedException', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, type: 'refresh' });
      // 로그아웃된 사용자는 refresh_token이 null
      usersRepo.queryBuilder.getOne.mockResolvedValue({ ...savedUser, refresh_token: null });

      await expect(service.refresh('some.refresh.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('사용자를 찾을 수 없음 → UnauthorizedException', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 999, type: 'refresh' });
      usersRepo.queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.refresh('valid.refresh.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('정상 로그아웃 → refresh_token null로 업데이트', async () => {
      const res = await service.logout(1);

      expect(usersRepo.update).toHaveBeenCalledWith(1, { refresh_token: null });
      expect(res).toEqual({ message: '로그아웃 되었습니다.' });
    });
  });
});

