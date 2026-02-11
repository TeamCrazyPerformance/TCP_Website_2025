import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyPageTeamsController } from './mypage-teams.controller';
import { MyPageTeamsService } from './mypage-teams.service';
import { Team } from '../../teams/entities/team.entity';
import { TeamMember } from '../../teams/entities/team-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember]),
  ],
  controllers: [MyPageTeamsController],
  providers: [MyPageTeamsService],
})
export class MyPageTeamsModule {}
