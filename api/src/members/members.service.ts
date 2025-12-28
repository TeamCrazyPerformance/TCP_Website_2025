import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PublicUserDto } from './dto/public-user.dto';
import { IsNull } from 'typeorm';

@Injectable()
export class MembersService {
    constructor(
      @InjectRepository(User)
      private readonly userRepository: Repository<User>,
    ) {}

    async getPublicMemberList(): Promise<PublicUserDto[]> {
      const users = await this.userRepository.find({
        where: { deleted_at: IsNull() },
      });
      return users.map((user) => ({
        name: user.name,
        profile_image: user.profile_image,
        self_description: user.self_description,
        ...(user.is_public_email && { email: user.email }),
        ...(user.is_public_tech_stack && { tech_stack: user.tech_stack }),
        ...(user.is_public_education_status && { education_status: user.education_status }),
        ...(user.is_public_github_username && { github_username: user.github_username }),
        ...(user.is_public_portfolio_link && { portfolio_link: user.portfolio_link }),
      }));
    }
}
