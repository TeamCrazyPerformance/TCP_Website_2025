import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { EducationStatus } from '../members/entities/enums/education-status.enum';
import { UserGender } from '../members/entities/enums/user-gender.enum';
import { UserRole } from '../members/entities/enums/user-role.enum';
import { Response, Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };

  const mockUser = {
    id: 'test-uuid-user-1',
    username: 'stce01',
    name: '홍길동',
    email: 'stce01@example.com',
    student_number: '20230001',
    profile_image: 'default_profile_image.png',
    role: UserRole.GUEST,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  // Mock Response 객체
  const createMockResponse = (): Partial<Response> => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  // Mock Request 객체
  const createMockRequest = (cookies: Record<string, string> = {}): Partial<Request> => ({
    cookies,
  });

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
    it('유효 DTO면 서비스 호출 & access_token 반환 (refresh_token은 쿠키로)', async () => {
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

      const mockRes = createMockResponse();
      const res = await controller.register(dto, mockRes as Response);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.access_token).toBeDefined();
      // refresh_token은 응답 body에서 제거됨
      expect((res as any).refresh_token).toBeUndefined();
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
    it('로그인 성공 → access_token 반환 (refresh_token은 쿠키로)', async () => {
      const dto = { username: 'stce01', password: 'P@ssword1234' };
      const mockResult = {
        user: mockUser,
        access_token: 'access.token',
        refresh_token: 'refresh.token',
      };
      mockAuthService.login.mockResolvedValue(mockResult);

      const mockRes = createMockResponse();
      const res = await controller.login(dto, mockRes as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.access_token).toBeDefined();
      expect((res as any).refresh_token).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('쿠키에서 유효한 refresh_token → 새 토큰 반환', async () => {
      const mockReq = createMockRequest({ refresh_token: 'valid.refresh.token' });
      const mockRes = createMockResponse();
      const mockResult = {
        user: mockUser,
        access_token: 'new.access.token',
        refresh_token: 'new.refresh.token',
      };
      mockAuthService.refresh.mockResolvedValue(mockResult);

      const res = await controller.refresh(mockReq as Request, mockRes as Response);

      expect(mockAuthService.refresh).toHaveBeenCalledWith('valid.refresh.token');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new.refresh.token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.access_token).toBeDefined();
      expect((res as any).refresh_token).toBeUndefined();
    });

    it('쿠키에 refresh_token 없으면 → UnauthorizedException', async () => {
      const mockReq = createMockRequest({}); // 쿠키 없음
      const mockRes = createMockResponse();

      await expect(controller.refresh(mockReq as Request, mockRes as Response))
        .rejects.toBeInstanceOf(UnauthorizedException);

      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('로그아웃 성공 → 쿠키 삭제 & 성공 메시지 반환', async () => {
      const mockReq = { user: { userId: 'test-uuid-user-1' } };
      const mockExpressReq = { cookies: { refresh_token: 'test.refresh.token' } };
      const mockRes = createMockResponse();
      const mockResult = { message: '로그아웃 되었습니다.' };
      mockAuthService.logout.mockResolvedValue(mockResult);

      const res = await controller.logout(mockReq as any, mockExpressReq as any, mockRes as Response);

      expect(mockAuthService.logout).toHaveBeenCalledWith('test-uuid-user-1', 'test.refresh.token');
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.message).toBe('로그아웃 되었습니다.');
    });
  });
});
