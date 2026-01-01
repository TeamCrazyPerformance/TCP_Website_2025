import {
    Controller,
    Get,
    Patch,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MembersService } from './members.service';
import { PublicUserDto } from './dto/public-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/members')
export class MembersController {
    constructor(private readonly membersService: MembersService) { }

    @Get()
    getAllMembers(): Promise<PublicUserDto[]> {
        return this.membersService.getPublicMemberList();
    }

    /**
     * @description 현재 로그인한 사용자의 프로필 이미지를 업로드/변경합니다.
     * @param file 업로드할 이미지 파일
     * @param req 인증된 사용자 정보가 포함된 요청 객체
     * @returns 업데이트된 프로필 이미지 경로
     */
    @Patch('me/profile-image')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file'))
    async updateProfileImage(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB limit
                    new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
                ],
            }),
        )
        file: Express.Multer.File,
        @Req() req: any,
    ): Promise<{ profile_image: string }> {
        const userId = req.user.userId;
        return this.membersService.updateProfileImage(userId, file);
    }
}
