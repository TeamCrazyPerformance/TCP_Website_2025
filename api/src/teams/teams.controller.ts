import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { UpdateTeamStatusDto } from './dto/update-team-status.dto';
import { ApplyTeamDto } from './dto/apply-team.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/v1/teams')
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) {}

    // 모집글 생성
    @Post()
    @UseGuards(AuthGuard('jwt'))
    create(@Req() req: any, @Body() dto: CreateTeamDto) {
        const userId = req.user.userId;
        return this.teamsService.create(userId, dto);
    }

    // 모집글 조회
    @Get()
    findAll() {
        return this.teamsService.findAll();
    }

    // 모집글 상세 조회
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.teamsService.findOne(id);
    }

    // 모집글 수정
    @Patch(':id')
    @UseGuards(AuthGuard('jwt'))
    update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
        const userId = req.user.userId;
        return this.teamsService.update(userId, id, dto);
    }

    // 모집글 삭제
    @Delete(':id')
    @HttpCode(204)
    @UseGuards(AuthGuard('jwt'))
    remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        const userId = req.user.userId;
        return this.teamsService.remove(userId, id);
    }

    // 모집 상태 변경
    @Patch(':id/status')
    @UseGuards(AuthGuard('jwt'))
    changeStatus(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamStatusDto,) {
        const userId = req.user.userId;
        return this.teamsService.changeStatus(userId, id, dto.status);
    }

    // 팀 지원
    @Post(':id/apply')
    @UseGuards(AuthGuard('jwt'))
    apply(@Req() req: any, @Param('id', ParseIntPipe) teamId: number, @Body() dto: ApplyTeamDto,) {
        const userId = req.user.userId;
        return this.teamsService.apply(userId, teamId, dto);
    }

    // 팀 지원 취소
    @Delete(':id/apply')
    @UseGuards(AuthGuard('jwt'))
    cancelApplication(@Req() req: any, @Param('id', ParseIntPipe) teamId: number) {
        const userId = req.user.userId;
        return this.teamsService.cancelApply(userId, teamId);
    }
}
