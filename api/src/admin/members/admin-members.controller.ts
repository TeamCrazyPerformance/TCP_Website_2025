import {
  Controller,
  Get,
  Query,
  Param,
  Patch,
  Delete,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AdminMembersService } from './admin-members.service';
import { UpdateMemberDto } from './dto/update-member.dto';
import { User } from '../../members/entities/user.entity';
import { AdminMemberSearchQueryDto } from './dto/admin-member-search.dto';
//import { AuthGuard, AdminGuard } from '';

@Controller('api/v1/admin/members')
//@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminMembersController {
  constructor(private readonly adminMembersService: AdminMembersService) {}

  @Get('search')
  searchMembers(
    @Query() query: AdminMemberSearchQueryDto,
  ): Promise<User[]> {
    return this.adminMembersService.search(query.type, query.word);
  }

  @Patch(':id')
  updateMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateMemberDto,
  ): Promise<User> {
    return this.adminMembersService.update(id, updateDto);
  }

  @Delete(':id')
  deleteMember(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.adminMembersService.remove(id);
  }
}
