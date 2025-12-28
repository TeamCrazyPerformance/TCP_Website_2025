import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AdminMembersService } from './admin-members.service';
import { AdminUpdateMemberDto } from './dto/admin-update-member.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../members/entities/enums/user-role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/v1/admin/members')
export class AdminMembersController {
  constructor(private readonly adminMembersService: AdminMembersService) {}

  @Get()
  findAllMembers() {
    return this.adminMembersService.findAllMembers();
  }

  @Patch(':id')
  updateMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateMemberDto,
  ) {
    return this.adminMembersService.updateMember(id, dto);
  }

  @Delete(':id')
  deleteMember(@Param('id', ParseIntPipe) id: number) {
    return this.adminMembersService.deleteMember(id);
  }
}
