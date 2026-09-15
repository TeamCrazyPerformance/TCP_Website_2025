import { Repository } from 'typeorm';
import { StudyService } from './study.service';
import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { StudyMember } from './entities/study-member.entity';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';
import { StudyMemberRole } from './entities/enums/study-member-role.enum';
import { UserRole } from '../members/entities/enums/user-role.enum';

describe('Study detail member majors', () => {
  const member = { id: 'member', name: '회원', major: '컴퓨터공학과' };
  const studyRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      studyMembers: [
        { user: member, role: StudyMemberRole.MEMBER },
        { user: { id: 'empty', name: '미입력 회원' }, role: StudyMemberRole.MEMBER },
      ],
      resources: [],
      progress: [],
    }),
  };
  const userRepository = {
    findOneBy: jest.fn().mockResolvedValue({ role: UserRole.MEMBER }),
  };
  const service = new StudyService(
    studyRepository as unknown as Repository<Study>,
    userRepository as unknown as Repository<User>,
    {} as Repository<StudyMember>,
    {} as Repository<Progress>,
    {} as Repository<Resource>,
  );

  it('includes the saved major and represents missing majors as null', async () => {
    const result = await service.findById(1, 'member');
    expect(result.members).toEqual([
      expect.objectContaining({ user_id: 'member', major: '컴퓨터공학과' }),
      expect.objectContaining({ user_id: 'empty', major: null }),
    ]);
  });

  it('keeps member information hidden from nonmembers', async () => {
    const result = await service.findById(1, 'outsider');
    expect(result.members).toBeUndefined();
  });
});
