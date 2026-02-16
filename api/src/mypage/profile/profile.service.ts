import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole } from '../../members/entities/enums/user-role.enum';


@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  private readonly defaultImages = [
    'default_profile_image.png',
    'default_profile_image.webp',
    'default_graduate_profile_image.webp',
    'default_admin_profile_image.webp'
  ];

  async getMyProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'username',
        'name',
        'username',
        'student_number',
        'major',
        'current_company',
        'profile_image',
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

    if (user.profile_image) {
      // 기본 이미지가 아니고, http로 시작하지 않고, /로 시작하지 않으면 /profiles/ 추가
      const isDefaultImage = [
        'default_profile_image.png',
        'default_profile_image.webp',
        'default_graduate_profile_image.webp',
        'default_admin_profile_image.webp'
      ].includes(user.profile_image);

      if (!user.profile_image.startsWith('http') && !user.profile_image.startsWith('/')) {
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
      if (dto[key] !== undefined) {
        user[key] = dto[key];
      }
    });

    // 학적 상태 변경 시 기본 이미지 자동 업데이트 로직
    if (dto.education_status && this.defaultImages.includes(user.profile_image)) {
      // 1. 관리자라면 학적 상태와 무관하게 항상 관리자 이미지
      if (user.role === UserRole.ADMIN) {
        user.profile_image = 'default_admin_profile_image.webp';
      } else if (dto.education_status === '졸업') {
        // 2. 졸업생이라면 졸업 이미지
        user.profile_image = 'default_graduate_profile_image.webp';
      } else {
        // 3. 그 외 (재학/휴학 등) -> 일반 이미지
        user.profile_image = 'default_profile_image.webp';
      }
    }

    return this.userRepository.save(user);
  }
}
