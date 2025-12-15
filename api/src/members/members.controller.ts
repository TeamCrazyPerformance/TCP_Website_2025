import { Controller, Get } from '@nestjs/common';
import { MembersService } from './members.service';
import { PublicUserDto } from './dto/public-user.dto';

@Controller('api/v1/members')
export class MembersController {
    constructor(private readonly membersService: MembersService){}

    @Get()
    getAllMembers(): Promise<PublicUserDto[]>{
        return this.membersService.getPublicMemberList();
    }
}
