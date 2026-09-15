import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StudyService } from './study.service';
import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { StudyMember } from './entities/study-member.entity';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';
import { StudyMemberRole as Role } from './entities/enums/study-member-role.enum';

describe('Study leadership transitions', () => {
  const repository = { findOne: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const service = new StudyService(
    {} as Repository<Study>,
    {} as Repository<User>,
    repository as unknown as Repository<StudyMember>,
    {} as Repository<Progress>,
    {} as Repository<Resource>,
  );
  beforeEach(() => jest.resetAllMocks());

  it('nominates an active member without removing their membership', async () => {
    const member = { id: 10, role: Role.MEMBER };
    repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(member);
    await service.nominateLeader(1, 'member');
    expect(repository.save).toHaveBeenCalledWith({ id: 10, role: Role.NOMINEE });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('rejects another nomination while a nominee is waiting', async () => {
    repository.findOne.mockResolvedValue({ role: Role.NOMINEE });
    await expect(service.nominateLeader(1, 'member')).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('promotes an accepting nominee to leader', async () => {
    repository.findOne.mockResolvedValue({ id: 10, role: Role.NOMINEE });
    await service.acceptLeaderNomination(1, 'member');
    expect(repository.save).toHaveBeenCalledWith({ id: 10, role: Role.LEADER });
  });

  it('returns a declining nominee to member without deleting them', async () => {
    repository.findOne.mockResolvedValue({ id: 10, role: Role.NOMINEE });
    await service.declineLeaderNomination(1, 'member');
    expect(repository.save).toHaveBeenCalledWith({ id: 10, role: Role.MEMBER });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes nominee membership when the removal endpoint is used', async () => {
    repository.findOne.mockResolvedValue({ id: 10, role: Role.NOMINEE });
    await service.removeMember(1, 'member');
    expect(repository.delete).toHaveBeenCalledWith(10);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
