import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../members/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
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

const mockRefreshTokenRepo = (): MockRepo<RefreshToken> => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
});

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
  let refreshTokenRepo: ReturnType<typeof mockRefreshTokenRepo>;
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
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  } as User;

  beforeEach(async () => {
    jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed_pw'));
    jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

    const repoInstance = mockUsersRepo();
    const refreshTokenRepoInstance = mockRefreshTokenRepo();
    const jwtInstance = mockJwtService();
    const configInstance = mockConfigService({ BCRYPT_SALT_ROUNDS: 12, JWT_SECRET: 'secret' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repoInstance },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepoInstance },
        { provide: JwtService, useValue: jwtInstance },
        { provide: ConfigService, useValue: configInstance },
      ],
    }).compile();

    service = module.get(AuthService);
    usersRepo = repoInstance;
    refreshTokenRepo = refreshTokenRepoInstance;
    jwt = jwtInstance;
    config = configInstance;

    // 기본 mock 초기화
    usersRepo.findOne!.mockReset();
    usersRepo.create!.mockReset();
    usersRepo.save!.mockReset();
    usersRepo.update!.mockReset().mockResolvedValue({ affected: 1 });
    refreshTokenRepo.create!.mockReset().mockReturnValue({ id: 1 });
    refreshTokenRepo.save!.mockReset().mockResolvedValue({ id: 1 });
    refreshTokenRepo.find!.mockReset();
    refreshTokenRepo.delete!.mockReset().mockResolvedValue({ affected: 1 });
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

      // RefreshToken 테이블에 저장 확인
      expect(refreshTokenRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        token_hash: 'hashed_pw',
        user_id: savedUser.id,
      }));
      expect(refreshTokenRepo.save).toHaveBeenCalled();

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
    const storedToken: RefreshToken = {
      id: 1,
      token_hash: 'hashed_refresh_token',
      user_id: 1,
      device_info: 'Chrome on Mac',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      last_used_at: null,
      created_at: new Date(),
      user: savedUser,
    };

    it('유효한 refresh_token → 새 토큰 발급 (해시 비교)', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, type: 'refresh' });
      usersRepo.findOne!.mockResolvedValue(savedUser);
      refreshTokenRepo.find!.mockResolvedValue([storedToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.refresh('client.refresh.token');

      expect(jwt.verifyAsync).toHaveBeenCalledWith('client.refresh.token', { secret: 'secret' });
      expect(bcrypt.compare).toHaveBeenCalledWith('client.refresh.token', 'hashed_refresh_token');

      // 기존 토큰 삭제 확인 (Token Rotation)
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ id: storedToken.id });

      expect(res).toEqual({
        user: expect.objectContaining({ id: savedUser.id }),
        access_token: 'signed.jwt.token',
        refresh_token: 'signed.jwt.token',
      });
    });

    it('DB에 저장된 token과 불일치 → Reuse Detection으로 세션 무효화', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, type: 'refresh' });
      usersRepo.findOne!.mockResolvedValue(savedUser);
      refreshTokenRepo.find!.mockResolvedValue([storedToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refresh('stolen.or.old.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);

      // Reuse Detection: 모든 세션 무효화 확인
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ user_id: savedUser.id });
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
      usersRepo.findOne!.mockResolvedValue(savedUser);
      // 로그아웃된 사용자는 토큰이 없음
      refreshTokenRepo.find!.mockResolvedValue([]);

      await expect(service.refresh('some.refresh.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('사용자를 찾을 수 없음 → UnauthorizedException', async () => {
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 999, type: 'refresh' });
      usersRepo.findOne!.mockResolvedValue(null);

      await expect(service.refresh('valid.refresh.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('DB에 저장된 토큰이 만료됨 → 토큰 삭제 및 UnauthorizedException', async () => {
      const expiredToken = {
        ...storedToken,
        expires_at: new Date(Date.now() - 1000), // 과거 시간
      };
      (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 1, type: 'refresh' });
      usersRepo.findOne!.mockResolvedValue(savedUser);
      refreshTokenRepo.find!.mockResolvedValue([expiredToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.refresh('client.refresh.token'))
        .rejects.toBeInstanceOf(UnauthorizedException);

      // 만료된 토큰 삭제 확인
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ id: expiredToken.id });
    });
  });

  describe('logout', () => {
    const storedToken: RefreshToken = {
      id: 1,
      token_hash: 'hashed_refresh_token',
      user_id: 1,
      device_info: 'Chrome on Mac',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      last_used_at: null,
      created_at: new Date(),
      user: savedUser,
    };

    it('refresh_token 제공 시 → 해당 토큰만 삭제 (현재 디바이스 로그아웃)', async () => {
      refreshTokenRepo.find!.mockResolvedValue([storedToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.logout(1, 'client.refresh.token');

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ id: storedToken.id });
      expect(res).toEqual({ message: '로그아웃 되었습니다.' });
    });

    it('refresh_token 미제공 시 → 모든 토큰 삭제 (모든 디바이스 로그아웃)', async () => {
      const res = await service.logout(1);

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ user_id: 1 });
      expect(res).toEqual({ message: '로그아웃 되었습니다.' });
    });
  });

  describe('logoutAll', () => {
    it('모든 디바이스에서 로그아웃 → 모든 토큰 삭제', async () => {
      const res = await service.logoutAll(1);

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ user_id: 1 });
      expect(res).toEqual({ message: '모든 기기에서 로그아웃 되었습니다.' });
    });
  });
});
