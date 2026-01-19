import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MyPageStudyService } from './mypage-study.service';

@Controller('api/v1/mypage/study')
@UseGuards(JwtAuthGuard)
export class MyPageStudyController {
  constructor(private readonly service: MyPageStudyService) {}

  @Get()
  findMyStudies(@Req() req: any) {
    const userId = req.user.userId;
    return this.service.findMyStudies(userId);
  }

  @Get(':id')
  findMyStudyDetail(
    @Req() req: any,
    @Param('id', ParseIntPipe) studyId: number,
  ) {
    const userId = req.user.userId;
    return this.service.findMyStudyDetail(userId, studyId);
  }
}
