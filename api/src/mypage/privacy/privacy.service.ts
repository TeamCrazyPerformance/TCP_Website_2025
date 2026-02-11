import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}


  async getPrivacySettings(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        is_public_email: true,
        is_public_tech_stack: true,
        is_public_github_username: true,
        is_public_portfolio_link: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updatePrivacySettings(
    userId: string,
    dto: UpdatePrivacyDto,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, dto);

    return await this.userRepository.save(user);
  }
}
