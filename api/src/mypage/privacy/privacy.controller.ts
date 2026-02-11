import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/v1/mypage/privacy')
@UseGuards(JwtAuthGuard)
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get()
  getPrivacySettings(@Req() req) {
    return this.privacyService.getPrivacySettings(req.user.userId);
  }


  @Patch()
  updatePrivacySettings(
    @Req() req,
    @Body() dto: UpdatePrivacyDto,
  ) {
    return this.privacyService.updatePrivacySettings(req.user.userId, dto);
  }
}
