import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  async getMyProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'name',
        'username',
        'student_number',
        'major',
        'current_company',
        'profile_image',
        'email',
        'tech_stack',
        'education_status',
        'github_username',
        'baekjoon_username',
        'gender',
        'birth_date',
        'join_year',
        'self_description',
        'portfolio_link',
      ],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (user.profile_image && user.profile_image !== 'default_profile_image.png') {
      if (!user.profile_image.startsWith('http')) {
        user.profile_image = `/profiles/${user.profile_image}`;
      }
    } else {
      (user as any).profile_image = null;
    }

    return user;
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // DTO에서 실제로 값이 제공된 속성들만 업데이트
    Object.keys(dto).forEach(key => {
      if (dto[key] !== undefined && dto[key] !== null) {
        user[key] = dto[key];
      }
    });

    return this.userRepository.save(user);
  }
}
