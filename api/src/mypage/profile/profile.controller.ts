import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/v1/mypage/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getMyProfile(@Req() req) {
    const userId: string = req.user.userId;
    return this.profileService.getMyProfile(userId);
  }

  @Patch()
  updateMyProfile(
    @Req() req,
    @Body() dto: UpdateProfileDto,
  ) {
    const userId: string = req.user.userId;
    return this.profileService.updateMyProfile(userId, dto);
  }
}
