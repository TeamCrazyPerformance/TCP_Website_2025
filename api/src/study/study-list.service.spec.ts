import { Repository } from 'typeorm';
import { StudyService } from './study.service';
import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { StudyMember } from './entities/study-member.entity';
import { StudyMemberRole } from './entities/enums/study-member-role.enum';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';

describe('StudyService study list', () => {
  const studyRepository = {
    find: jest.fn(),
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
    jest.useFakeTimers().setSystemTime(new Date('2026-10-02T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the metadata and active-member metrics required by the dashboard', async () => {
    const applyDeadline = new Date('2026-09-30T00:00:00.000Z');
    studyRepository.find.mockResolvedValue([
      {
        id: 12,
        study_name: 'NestJS Study',
        start_year: 2026,
        study_description: 'Backend study',
        tag: 'NestJS, TypeScript',
        recruit_count: 6,
        period: '2026.09.01 ~ 2026.12.31',
        apply_deadline: applyDeadline,
        place: 'Club room',
        way: 'Offline',
        cycle: 'Weekly',
        is_public: false,
        studyMembers: [
          {
            role: StudyMemberRole.LEADER,
            user: { name: 'Leader' },
          },
          { role: StudyMemberRole.MEMBER, user: { name: 'Member' } },
          { role: StudyMemberRole.NOMINEE, user: { name: 'Nominee' } },
          { role: StudyMemberRole.PENDING, user: { name: 'Applicant' } },
        ],
      } as unknown as Study,
    ]);

    await expect(service.findAll(2026)).resolves.toEqual([
      {
        id: 12,
        study_name: 'NestJS Study',
        start_year: 2026,
        study_description: 'Backend study',
        tag: 'NestJS, TypeScript',
        recruit_count: 6,
        period: '2026.09.01 ~ 2026.12.31',
        apply_deadline: applyDeadline,
        place: 'Club room',
        way: 'Offline',
        cycle: 'Weekly',
        is_public: false,
        leader_name: 'Leader',
        members_count: 3,
        status: 'ongoing',
      },
    ]);
    expect(studyRepository.find).toHaveBeenCalledWith({
      where: { start_year: 2026 },
      relations: ['studyMembers', 'studyMembers.user'],
    });
  });

  it('classifies every study by its period rather than the recruitment deadline', async () => {
    studyRepository.find.mockResolvedValue([
      { id: 1, period: '2026.09.01 ~ 2026.12.31', apply_deadline: new Date('2026-09-01'), is_public: false },
      { id: 2, period: '2026.11.01 ~ 2026.12.31', is_public: true },
      { id: 3, period: '2026.03 ~ 2026.05', apply_deadline: new Date('2026-12-31'), is_public: false },
      { id: 4, period: null, is_public: true },
    ] as Study[]);

    const studies = await service.findAll();

    expect(studies.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 1, status: 'ongoing' },
      { id: 2, status: 'upcoming' },
      { id: 3, status: 'completed' },
      { id: 4, status: 'unknown' },
    ]);
  });

  it('returns the upcoming status when a future study is created', async () => {
    const period = '2026.11.01 ~ 2026.12.31';
    const createService = new StudyService(
      {
        create: jest.fn((data) => data),
        save: jest.fn().mockResolvedValue({ id: 99, period }),
      } as never,
      { findOneBy: jest.fn().mockResolvedValue({ id: 'leader' }) } as never,
      {
        create: jest.fn((data) => data),
        save: jest.fn().mockResolvedValue({}),
      } as never,
      {} as Repository<Progress>,
      {} as Repository<Resource>,
    );

    await expect(createService.create('leader', {
      study_name: 'Future study',
      start_year: 2026,
      period,
      apply_deadline: '2026-10-31',
    })).resolves.toEqual({ success: true, id: 99, status: 'upcoming' });
  });
});
