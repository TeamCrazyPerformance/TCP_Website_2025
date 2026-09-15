import * as fs from 'fs';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StudyService } from './study.service';
import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { StudyMember } from './entities/study-member.entity';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';

describe('StudyService study deletion', () => {
  const studyRepository = {
    findOne: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<Repository<Study>>;

  const service = new StudyService(
    studyRepository,
    {} as Repository<User>,
    {} as Repository<StudyMember>,
    {} as Repository<Progress>,
    {} as Repository<Resource>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes the study once and removes every persisted resource file', async () => {
    studyRepository.findOne.mockResolvedValue({
      id: 7,
      resources: [
        { dir_path: 'uploads/resources/first.pdf' },
        { dir_path: 'uploads/resources/already-removed.pdf' },
      ],
    } as unknown as Study);
    studyRepository.delete.mockResolvedValue({ affected: 1, raw: {} });
    const unlink = jest
      .spyOn(fs.promises, 'unlink')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      );

    await expect(service.delete(7)).resolves.toEqual({ success: true });

    expect(studyRepository.findOne).toHaveBeenCalledWith({
      where: { id: 7 },
      relations: ['resources'],
    });
    expect(studyRepository.delete).toHaveBeenCalledTimes(1);
    expect(studyRepository.delete).toHaveBeenCalledWith(7);
    expect(unlink).toHaveBeenCalledTimes(2);
  });

  it('does not issue a delete for a missing study', async () => {
    studyRepository.findOne.mockResolvedValue(null);

    await expect(service.delete(404)).rejects.toThrow(NotFoundException);

    expect(studyRepository.delete).not.toHaveBeenCalled();
  });

  it('does not remove files when the database delete fails', async () => {
    studyRepository.findOne.mockResolvedValue({
      id: 7,
      resources: [{ dir_path: 'uploads/resources/first.pdf' }],
    } as unknown as Study);
    studyRepository.delete.mockRejectedValue(new Error('database failure'));
    const unlink = jest.spyOn(fs.promises, 'unlink');

    await expect(service.delete(7)).rejects.toThrow('database failure');

    expect(unlink).not.toHaveBeenCalled();
  });
});
