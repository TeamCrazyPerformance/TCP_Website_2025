import {
  Controller,
  Delete,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/v1/mypage/withdraw')
@UseGuards(JwtAuthGuard)
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  @Post('verify-password')
  verifyPassword(
    @Req() req,
    @Body() dto: WithdrawDto,
  ) {
    return this.withdrawService.verifyPassword(req.user.userId, dto);
  }

  @Delete()
  withdraw(@Req() req) {
    return this.withdrawService.withdraw(req.user.userId);
  }
}
