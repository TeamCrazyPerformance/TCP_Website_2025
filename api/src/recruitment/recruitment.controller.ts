import { Response } from 'express';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Res,
} from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { CreateRecruitmentDto } from './dto/create-recruitment.dto';
import { UpdateRecruitmentDto } from './dto/update-recruitment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from 'src/members/entities/enums/user-role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('api/v1/recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) { }

  // 지원서 작성, 제출
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRecruitmentDto: CreateRecruitmentDto) {
    return this.recruitmentService.create(createRecruitmentDto);
  }

  // 모든 지원서를 조회 (관리자 전용)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.recruitmentService.findAll();
  }

  // 현재 모집 상태 조회 (공개) - 반드시 :id 라우트보다 위에 위치해야 함
  @Get('status')
  getRecruitmentStatus() {
    return this.recruitmentService.getRecruitmentStatus();
  }

  // 모든 지원서를 텍스트 파일로 변환하여 압축 파일로 다운로드 (관리자 전용)
  @Get('download-all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async downloadAll(@Res() res: Response) {
    const { stream, filename } = await this.recruitmentService.downloadAll();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    stream.pipe(res);
  }

  // 특정 지원서 조회 (관리자 전용)
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.recruitmentService.findOne(+id);
  }

  // ID로 특정 지원서를 수정 (관리자 전용)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateRecruitmentDto: UpdateRecruitmentDto,
  ) {
    return this.recruitmentService.update(+id, updateRecruitmentDto);
  }

  // ID로 특정 지원서를 삭제 (관리자 전용)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.recruitmentService.remove(+id);
  }
}
