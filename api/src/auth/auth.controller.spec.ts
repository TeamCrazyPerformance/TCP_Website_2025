import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { EducationStatus } from '../members/entities/enums/education-status.enum';
import { UserGender } from '../members/entities/enums/user-gender.enum';
import { UserRole } from '../members/entities/enums/user-role.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };

  const mockUser = {
    id: 1,
    username: 'stce01',
    name: '홍길동',
    email: 'stce01@example.com',
    student_number: '20230001',
    profile_image: 'default_profile_image.png',
    role: UserRole.GUEST,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('register', () => {
    it('유효 DTO면 서비스 호출 & access_token + refresh_token 반환', async () => {
      const dto: RegisterDto = {
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
        tech_stack: ['NestJS'],
      };

      const mockResult = {
        user: mockUser,
        access_token: 'access.token',
        refresh_token: 'refresh.token',
      };
      mockAuthService.register.mockResolvedValue(mockResult);

      const res = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(res).toBe(mockResult);
      expect(res.access_token).toBeDefined();
      expect(res.refresh_token).toBeDefined();
    });

    it('DTO 유효성: 잘못된 필드면 ValidationPipe에서 예외', async () => {
      const pipe = new ValidationPipe({ whitelist: true, transform: true });

      const dto: any = {
        username: 'a',
        password: 'short',
        name: '',
        student_number: '',
        phone_number: '010',
        email: 'not-an-email',
        major: '',
        join_year: 'not-number',
        birth_date: 'not-date',
        gender: 'Alien',
        education_status: 'Unknown',
      };

      await expect(
        pipe.transform(dto, {
          type: 'body',
          metatype: (RegisterDto as unknown) as new () => any,
        }),
      ).rejects.toBeDefined();

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('로그인 성공 → access_token + refresh_token 반환', async () => {
      const dto = { username: 'stce01', password: 'P@ssword1234' };
      const mockResult = {
        user: mockUser,
        access_token: 'access.token',
        refresh_token: 'refresh.token',
      };
      mockAuthService.login.mockResolvedValue(mockResult);

      const res = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(res.access_token).toBeDefined();
      expect(res.refresh_token).toBeDefined();
    });
  });

  describe('refresh', () => {
    it('유효한 refresh_token → 새 토큰 반환', async () => {
      const dto = { refresh_token: 'valid.refresh.token' };
      const mockResult = {
        user: mockUser,
        access_token: 'new.access.token',
        refresh_token: 'new.refresh.token',
      };
      mockAuthService.refresh.mockResolvedValue(mockResult);

      const res = await controller.refresh(dto);

      expect(mockAuthService.refresh).toHaveBeenCalledWith('valid.refresh.token');
      expect(res.access_token).toBeDefined();
      expect(res.refresh_token).toBeDefined();
    });
  });

  describe('logout', () => {
    it('로그아웃 성공 → 성공 메시지 반환', async () => {
      const mockReq = { user: { userId: 1 } };
      const mockResult = { message: '로그아웃 되었습니다.' };
      mockAuthService.logout.mockResolvedValue(mockResult);

      const res = await controller.logout(mockReq);

      expect(mockAuthService.logout).toHaveBeenCalledWith(1);
      expect(res.message).toBe('로그아웃 되었습니다.');
    });
  });
});

