import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminMembersController } from './admin-members.controller';
import { AdminMembersService } from './admin-members.service';
import { User } from '../../members/entities/user.entity';
import { StudyMember } from '../../study/entities/study-member.entity';
import { TeamMember } from '../../teams/entities/team-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, StudyMember, TeamMember])],
  controllers: [AdminMembersController],
  providers: [AdminMembersService],
})
export class AdminMembersModule { }
