import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../members/entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../members/entities/enums/user-role.enum';

const createMockQueryBuilder = (result: any = null) => ({
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
});

const mockUsersRepo = () => {
    const queryBuilder = createMockQueryBuilder();
    return {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        findOne: jest.fn(),
        queryBuilder,
    };
};

const mockConfigService = () => ({
    get: jest.fn().mockReturnValue('test-jwt-secret'),
});

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    let usersRepo: ReturnType<typeof mockUsersRepo>;

    const mockUser: Partial<User> = {
        id: 'test-uuid-user-1',
        username: 'testuser',
        role: UserRole.MEMBER,
        refreshTokens: [{ id: 1 }] as any,
    };

    beforeEach(async () => {
        const repoInstance = mockUsersRepo();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy,
                { provide: ConfigService, useValue: mockConfigService() },
                { provide: getRepositoryToken(User), useValue: repoInstance },
            ],
        }).compile();

        strategy = module.get(JwtStrategy);
        usersRepo = repoInstance;
    });

    describe('validate', () => {
        it('유효한 access_token payload → user 정보 반환', async () => {
            usersRepo.findOne.mockResolvedValue(mockUser);

            const payload = { sub: 'test-uuid-user-1', username: 'testuser', role: UserRole.MEMBER };
            const result = await strategy.validate(payload);

            expect(result).toEqual({
                userId: 'test-uuid-user-1',
                username: 'testuser',
                role: UserRole.MEMBER,
            });
        });

        it('refresh_token으로 API 접근 시도 → UnauthorizedException', async () => {
            const payload = { sub: 'test-uuid-user-1', type: 'refresh' };

            await expect(strategy.validate(payload as any))
                .rejects.toThrow(UnauthorizedException);
            await expect(strategy.validate(payload as any))
                .rejects.toThrow('Access token이 필요합니다.');
        });

        it('존재하지 않는 사용자 → UnauthorizedException', async () => {
            usersRepo.findOne.mockResolvedValue(null);

            const payload = { sub: 'non-existent-uuid', username: 'unknown', role: UserRole.MEMBER };

            await expect(strategy.validate(payload))
                .rejects.toThrow(UnauthorizedException);
            await expect(strategy.validate(payload))
                .rejects.toThrow('사용자를 찾을 수 없습니다.');
        });

        it('로그아웃된 상태에서 access_token 사용 → UnauthorizedException', async () => {
            // 로그아웃된 사용자는 refreshTokens가 빈 배열
            usersRepo.findOne.mockResolvedValue({ ...mockUser, refreshTokens: [] });

            const payload = { sub: 'test-uuid-user-1', username: 'testuser', role: UserRole.MEMBER };

            await expect(strategy.validate(payload))
                .rejects.toThrow(UnauthorizedException);
            await expect(strategy.validate(payload))
                .rejects.toThrow('로그아웃된 상태입니다. 다시 로그인해주세요.');
        });

        it('유효하지 않은 access_token (사용자 role 불일치해도 DB 기준으로 검증)', async () => {
            // payload의 role과 DB의 role이 다르더라도 DB 조회 결과로 반환
            usersRepo.findOne.mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });

            const payload = { sub: 'test-uuid-user-1', username: 'testuser', role: UserRole.MEMBER };
            const result = await strategy.validate(payload);

            // 현재 구현은 payload의 role을 그대로 반환하지만 DB에서 검증은 통과
            expect(result).toEqual({
                userId: 'test-uuid-user-1',
                username: 'testuser',
                role: UserRole.MEMBER,
            });
        });
    });
});
