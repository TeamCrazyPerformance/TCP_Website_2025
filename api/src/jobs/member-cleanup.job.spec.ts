import { Test, TestingModule } from '@nestjs/testing';
import { MemberCleanupJob } from './member-cleanup.job';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource, FindOperator } from 'typeorm';
import { User } from '../members/entities/user.entity';

describe('MemberCleanupJob (unit)', () => {
  let job: MemberCleanupJob;
  let repo: Repository<User>;
  let dataSource: DataSource;
  let mockFind: jest.Mock;
  let mockRemove: jest.Mock;
  let mockTransaction: jest.Mock;

  beforeEach(async () => {
    mockFind = jest.fn();
    mockRemove = jest.fn();
    mockTransaction = jest.fn((callback) => callback({ remove: mockRemove }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberCleanupJob,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: mockFind,
            remove: mockRemove,
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: mockTransaction,
          },
        },
      ],
    }).compile();

    job = module.get(MemberCleanupJob);
    repo = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
  });

  it('2일 지난 soft delete 유저를 hard delete 한다', async () => {
    const expiredUser = { id: 'test-uuid-1' } as User;
    mockFind.mockResolvedValue([expiredUser]);
    mockRemove.mockResolvedValue([expiredUser]);

    await job.hardDeleteExpiredMembers();

    // find가 올바른 조건으로 호출되었는지 검증
    expect(mockFind).toHaveBeenCalledTimes(1);
    const callArgs = mockFind.mock.calls[0][0];

    expect(callArgs.withDeleted).toBe(true);
    expect(callArgs.where.deleted_at).toBeDefined();

    // 날짜 계산이 정확한지 검증
    const actualCondition = callArgs.where.deleted_at;
    expect(actualCondition).toBeInstanceOf(FindOperator);
    expect(actualCondition._type).toBe('lessThan');

    // 트랜잭션으로 삭제되었는지 검증
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith([expiredUser]);
  });

  it('대상이 없으면 remove를 호출하지 않는다', async () => {
    mockFind.mockResolvedValue([]);

    await job.hardDeleteExpiredMembers();

    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('에러 발생 시 로그를 남기고 크론 작업을 중단하지 않는다', async () => {
    const error = new Error('DB connection failed');
    mockFind.mockRejectedValue(error);

    // 에러가 throw되지 않고 정상 종료되어야 함
    await expect(job.hardDeleteExpiredMembers()).resolves.toBeUndefined();
  });
});
