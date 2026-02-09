import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawController } from './withdraw.controller';
import { WithdrawService } from './withdraw.service';
import { User } from '../../members/entities/user.entity';
import { StudyMember } from '../../study/entities/study-member.entity';
import { TeamMember } from '../../teams/entities/team-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, StudyMember, TeamMember])],
  controllers: [WithdrawController],
  providers: [WithdrawService],
})
export class WithdrawModule { }

