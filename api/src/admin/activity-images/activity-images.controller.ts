import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';
import { ActivityImagesService, TagsData } from './activity-images.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('/api/v1/admin/activity-images')
export class ActivityImagesController {
  constructor(private readonly service: ActivityImagesService) { }

  @Post('tags')
  async saveTags(@Body() tags: TagsData) {
    this.service.saveTags(tags);
    return { message: 'Tags saved successfully' };
  }

  @Delete('reset')
  async resetAll() {
    this.service.resetAll();
    return { message: 'All photos and tags reset successfully.' };
  }

  @Get('tags/export')
  async exportTags() {
    return this.service.getTags();
  }

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'competition', maxCount: 1 },
      { name: 'study', maxCount: 1 },
      { name: 'mt', maxCount: 1 },
    ]),
  )
  async upload(
    @UploadedFiles()
    files: {
      competition?: Express.Multer.File[];
      study?: Express.Multer.File[];
      mt?: Express.Multer.File[];
    },

    @Body()
    body?: {
      removeCompetition?: string;
      removeStudy?: string;
      removeMt?: string;
    },
  ) {
    await this.service.save(files, {
      competition: body?.removeCompetition === 'true',
      study: body?.removeStudy === 'true',
      mt: body?.removeMt === 'true',
    });

    return { message: '활동 사진 저장 완료' };
  }

  @Delete(':type')
  delete(@Param('type') type: string) {
    if (!['competition', 'study', 'mt'].includes(type)) {
      throw new BadRequestException(
        'type은 competition, study, mt 중 하나여야 합니다.',
      );
    }

    this.service.delete(type as 'competition' | 'study' | 'mt');
    return { message: `${type} 사진 삭제 완료` };
  }
}
