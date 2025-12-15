import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { EducationStatus } from '../members/entities/enums/education-status.enum';
import { UserGender } from '../members/entities/enums/user-gender.enum';

describe('AuthController.register', () => {
  let controller: AuthController;
  let mockAuthService: { register: jest.Mock };

  beforeEach(async () => {
    mockAuthService = { register: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get(AuthController);
  });

  it('유효 DTO면 서비스 호출 & 결과 반환', async () => {
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

    const mockResult = { user: { id: 1, username: 'stce01' }, access_token: 'abc' };
    mockAuthService.register.mockResolvedValue(mockResult);

    const res = await controller.register(dto);

    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    expect(res).toBe(mockResult);
  });

  it('DTO 유효성: 잘못된 필드면 ValidationPipe에서 예외', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const dto: any = {
      username: 'a',               // 길이 미달
      password: 'short',           // 길이 미달
      name: '',                    // 빈 값
      student_number: '',          // 빈 값
      phone_number: '010',         // 형식은 자유지만 길이 미달로 판단
      email: 'not-an-email',       // 이메일 형식 아님
      major: '',                   // 빈 값
      join_year: 'not-number',     // 숫자 아님
      birth_date: 'not-date',      // 날짜 아님
      gender: 'Alien',             // enum 아님
      education_status: 'Unknown', // enum 아님
    };

    await expect(
      pipe.transform(dto, {
        type: 'body',
        metatype: (RegisterDto as unknown) as new () => any,
      }),
    ).rejects.toBeDefined();

    // 검증에 막혀 서비스는 호출되지 않아야 함
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });
});
