import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { PublicUserDto } from './dto/public-user.dto';

@Injectable()
export class MembersService {
    constructor(
      @InjectRepository(User)
      private readonly userRepository: Repository<User>,
    ) {}

    async getPublicMemberList(): Promise<PublicUserDto[]> {
        const users = await this.userRepository.find();

        return users.map((user) => {
          const publicUser: PublicUserDto = {
            profile_image: user.profile_image,
            name: user.name,
            self_description: user.self_description,
          };

          if (user.is_public_email) 
            publicUser.email = user.email;

          if (user.is_public_tech_stack) 
            publicUser.tech_stack = user.tech_stack;

          if (user.is_public_education_status) 
            publicUser.education_status = user.education_status;

          if (user.is_public_github_username) 
            publicUser.github_username = user.github_username;

          if (user.is_public_portfolio_link) 
            publicUser.portfolio_link = user.portfolio_link;
          
          return publicUser;
        });
      }
}
