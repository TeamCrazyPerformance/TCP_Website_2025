import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { TeamRole } from './entities/team-role.entity';
import { TeamMember } from './entities/team-member.entity';
import { User } from '../members/entities/user.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamRole, TeamMember, User])],
  controllers: [TeamsController],
  providers: [TeamsService]
})
export class TeamsModule {}
