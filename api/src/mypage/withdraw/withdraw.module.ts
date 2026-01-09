import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawController } from './withdraw.controller';
import { WithdrawService } from './withdraw.service';
import { User } from '../../members/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [WithdrawController],
  providers: [WithdrawService],
})
export class WithdrawModule {}
