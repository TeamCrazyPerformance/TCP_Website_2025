import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class AdminMembersService {
    constructor(
      @InjectRepository(User)
      private readonly userRepository: Repository<User>,
    ) {}    
    
    async search(type: string, word: string): Promise<User[]> {
      const query = this.userRepository.createQueryBuilder('user');
    
      if (type === 'tech_stack') {
        return query
          .where(':word = ANY(user.tech_stack)', { word })
          .getMany();
      } else {
        return query
          .where(`user.${type} ILIKE :word`, { word: `%${word}%` })
          .getMany();
      }
    }

    async update(id: number, updateDto: UpdateMemberDto): Promise<User>{
      await this.userRepository.update(id, updateDto);
      const updatedUser = await this.userRepository.findOneBy({id});  
      if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    } 
    return updatedUser;
    } 

    async remove(id: number): Promise<void>{
      const result = await this.userRepository.delete(id);
      if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
      }
    }
}
