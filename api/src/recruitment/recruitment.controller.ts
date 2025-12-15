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
  // UseGuards,
} from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { CreateRecruitmentDto } from './dto/create-recruitment.dto';
import { UpdateRecruitmentDto } from './dto/update-recruitment.dto';

@Controller('api/v1/recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  // 지원서 작성, 제출
  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() createRecruitmentDto: CreateRecruitmentDto) {
    return this.recruitmentService.create(createRecruitmentDto);
  }

  // 모든 지원서를 조회 (관리자 전용)
  @Get()
  // @UseGuards(JwtAuthGuard, RolesGuard) // 나중에 권한 구현 시 주석 해제
  // @Roles('admin')
  findAll() {
    return this.recruitmentService.findAll();
  }

  // 특정 지원서 조회 (관리자 전용)
  @Get(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard) // 나중에 권한 구현 시 주석 해제
  // @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.recruitmentService.findOne(+id);
  }

  // ID로 특정 지원서를 수정 (관리자 전용)
  @Patch(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard) // 나중에 권한 구현 시 주석 해제
  // @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateRecruitmentDto: UpdateRecruitmentDto,
  ) {
    return this.recruitmentService.update(+id, updateRecruitmentDto);
  }

  // ID로 특정 지원서를 삭제 (관리자 전용)
  @Delete(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard) // 나중에 권한 구현 시 주석 해제
  // @Roles('admin')
  remove(@Param('id') id: string) {
    return this.recruitmentService.remove(+id);
  }
}
