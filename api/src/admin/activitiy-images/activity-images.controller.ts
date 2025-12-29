import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';
import { ActivityImagesService } from './activity-images.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('/api/v1/admin/activity-images')
export class ActivityImagesController {
  constructor(private readonly service: ActivityImagesService) {}

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
    body: {
      removeCompetition?: string;
      removeStudy?: string;
      removeMt?: string;
    },
  ) {
    await this.service.save(files, {
      competition: body.removeCompetition === 'true',
      study: body.removeStudy === 'true',
      mt: body.removeMt === 'true',
    });

    return { message: '활동 사진 저장 완료' };
  }
}
