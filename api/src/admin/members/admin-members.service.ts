import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { AdminUpdateMemberDto } from './dto/admin-update-member.dto';

@Injectable()
export class AdminMembersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // 관리자용 멤버 전체 조회 (soft delete 된 멤버는 제외)
  async findAllMembers() {
    return this.userRepository.find({
      where: {
        deleted_at: IsNull(),
      },
      select: [
        'id',
        'username',
        'name',
        'student_number',
        'profile_image',
        'email',
        'role',
        'join_year',
        'tech_stack',
        'education_status',
        'created_at',
      ],
      order: {
        name: 'ASC',
      },
    });
  }

  async updateMember(id: number, dto: AdminUpdateMemberDto) {
    const user = await this.userRepository.findOne({
      where: {
        id,
        deleted_at: IsNull(),
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않거나 삭제된 회원입니다.');
    }

    Object.assign(user, dto);

    return this.userRepository.save(user);
  }

  // 관리자용 멤버 삭제 (Soft Delete)
   async deleteMember(id: number): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        id,
        deleted_at: IsNull(),
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않거나 이미 삭제된 회원입니다.');
    }

    await this.userRepository.softRemove(user);
  }
}
