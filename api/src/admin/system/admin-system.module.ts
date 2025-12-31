import { Module } from '@nestjs/common';
import { AdminSystemController } from './admin-system.controller';
import { AdminSystemService } from './admin-system.service';

@Module({
    controllers: [AdminSystemController],
    providers: [AdminSystemService],
})
export class AdminSystemModule { }
