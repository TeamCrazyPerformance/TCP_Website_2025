import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberCleanupJob } from './member-cleanup.job';
import { User } from '../members/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [MemberCleanupJob],
})
export class JobsModule {}
