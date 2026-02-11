import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MyPageTeamsService } from './mypage-teams.service';

@Controller('api/v1/mypage/teams')
@UseGuards(AuthGuard('jwt'))
export class MyPageTeamsController {
  constructor(private readonly service: MyPageTeamsService) {}

  @Get()
  findMyTeams(@Req() req: any) {
    const userId = req.user.userId;
    return this.service.findMyTeams(userId);
  }

  @Get(':id')
  findMyTeamDetail(
    @Req() req: any,
    @Param('id', ParseIntPipe) teamId: number,
  ) {
    const userId = req.user.userId;
    return this.service.findMyTeamDetail(userId, teamId);
  }
}
