import { Module } from '@nestjs/common';
import { ActivityImagesController } from './activity-images.controller';
import { ActivityImagesService } from './activity-images.service';

@Module({
  controllers: [ActivityImagesController],
  providers: [ActivityImagesService],
  exports: [ActivityImagesService],
})
export class ActivityImagesModule { }
