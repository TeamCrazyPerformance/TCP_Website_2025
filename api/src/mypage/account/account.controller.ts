import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/v1/mypage/account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}


  @Get()
  getMyAccount(@Req() req: any) {
    const userId = req.user.userId;
    return this.accountService.getMyAccount(userId);
  }


  @Patch()
  updateMyAccount(
    @Req() req: any,
    @Body() dto: UpdateAccountDto,
  ) {
    const userId = req.user.userId;
    return this.accountService.updateMyAccount(userId, dto);
  }

  @Patch('password')
  changePassword(
    @Req() req: any,
    @Body() dto: ChangePasswordDto,
  ) {
    const userId = req.user.userId;
    return this.accountService.changePassword(userId, dto);
  }
}
