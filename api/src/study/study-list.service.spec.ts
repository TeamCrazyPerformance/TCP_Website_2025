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
      },
    ]);
    expect(studyRepository.find).toHaveBeenCalledWith({
      where: { start_year: 2026 },
      relations: ['studyMembers', 'studyMembers.user'],
    });
  });
});
