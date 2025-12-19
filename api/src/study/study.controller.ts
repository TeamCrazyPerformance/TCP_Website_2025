import {
  Controller,
  Get,
  Delete,
  Query,
  ValidationPipe,
  Param,
  ParseIntPipe,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudyService } from './study.service';

import { GetStudiesQueryDto } from './dto/request/get-studies-query.dto';
import { CreateStudyDto } from './dto/request/create-study.dto';
import { UpdateStudyLeaderDto } from './dto/request/update-study-leader.dto';
import { UpdateStudyDto } from './dto/request/update-study.dto';
import { AddStudyMemberDto } from './dto/request/add-study-member.dto';
import { SuccessResponseDto } from './dto/response/success-response.dto';
import { CreateStudyResponseDto } from './dto/response/create-study-response.dto';
import { StudyResponseDto } from './dto/response/study-response.dto';
import { StudyDetailResponseDto } from './dto/response/study-detail-response.dto';
import { StudyMemberResponseDto } from './dto/response/study-member.response.dto';
import { StudyMemberDetailResponseDto } from './dto/response/study-member-detail.response.dto';
import { AddStudyMemberResponseDto } from './dto/response/add-study-member-response.dto';
import { StudyProgressResponseDto } from './dto/response/study-progress.response.dto';
import { CreateProgressDto } from './dto/request/create-progress.dto';
import { CreateProgressResponseDto } from './dto/response/create-progress-response.dto';
import { UpdateProgressDto } from './dto/request/update-progress.dto';
import { StudyResourceResponseDto } from './dto/response/study-resource.response.dto';
import { SearchAvailableMembersQueryDto } from './dto/request/search-available-members-query.dto';
import { SearchAvailableMembersResponseDto } from './dto/response/search-available-members-response.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/members/entities/enums/user-role.enum';
import { StudyRolesGuard } from './guards/study-roles.guard';
import { StudyRoles } from './decorators/study-roles.decorator';
import { StudyMemberRole } from './entities/enums/study-member-role.enum';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('api/v1/study')
export class StudyController {
  constructor(private readonly studyService: StudyService) { }

  /**
   * @description Retrieves a list of studies, with an option to filter by year.
   * @param query A DTO containing query parameters, such as the optional 'year'.
   * @returns A promise that resolves to an array of study summary DTOs.
   */
  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: GetStudiesQueryDto,
  ): Promise<StudyResponseDto[]> {
    return this.studyService.findAll(query.year);
  }

  /**
   * @description Retrieves detailed information for a specific study. (스터디원, 스터디장, 관리자)
   * @param id The ID of the study to retrieve.
   * @returns A promise that resolves to a detailed DTO of the study.
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER, StudyMemberRole.MEMBER)
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyDetailResponseDto> {
    return this.studyService.findById(id);
  }

  /**
   * @description Creates a new study. (Admin only)
   * @param createStudyDto The data required to create a new study.
   * @returns A promise that resolves to an object containing the success status and the new study's ID.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(
    @Body() createStudyDto: CreateStudyDto,
  ): Promise<CreateStudyResponseDto> {
    return this.studyService.create(createStudyDto);
  }

  /**
   * @description Deletes a specific study by its ID. (Admin only)
   * @param id The ID of the study to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async delete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SuccessResponseDto> {
    return this.studyService.delete(id);
  }

  /**
   * @description Retrieves the list of members for a specific study. (Admin/Leader/Member only)
   * @param id The ID of the study.
   * @returns A promise that resolves to an array of study member DTOs.
   */
  @Get(':id/members')
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER, StudyMemberRole.MEMBER)
  async findMembers(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyMemberResponseDto[]> {
    return this.studyService.findMembersByStudyId(id);
  }

  /**
   * @description Retrieves detailed information of a specific member in a study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param userId The ID of the user to get details for.
   * @returns A promise that resolves to detailed member information.
   */
  @Get(':id/members/:userId')
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async findMemberDetail(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<StudyMemberDetailResponseDto> {
    return this.studyService.findMemberDetailByStudyId(id, userId);
  }

  /**
   * @description Updates a study's information. (Admin/Leader only)
   * @param id The ID of the study to update.
   * @param updateStudyDto A DTO containing the fields to update.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async updateStudy(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudyDto: UpdateStudyDto,
  ): Promise<SuccessResponseDto> {
    return this.studyService.updateStudy(id, updateStudyDto);
  }

  /**
   * @description Appoints or changes the leader of a study. (Admin only)
   * @param id The ID of the study to update.
   * @param updateStudyLeaderDto A DTO containing the new leader's user ID.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Patch(':id/leader')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateLeader(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudyLeaderDto: UpdateStudyLeaderDto,
  ): Promise<SuccessResponseDto> {
    return this.studyService.updateLeader(id, updateStudyLeaderDto.user_id);
  }

  /**
   * @description Adds a new member to a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param addStudyMemberDto A DTO containing the user ID of the member to add.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() addStudyMemberDto: AddStudyMemberDto,
  ): Promise<AddStudyMemberResponseDto> {
    return this.studyService.addMember(
      id,
      addStudyMemberDto.user_id,
      addStudyMemberDto.role,
    );
  }

  /**
   * @description Removes a member from a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param userId The ID of the user to remove from the study.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<SuccessResponseDto> {
    return await this.studyService.removeMember(id, userId);
  }

  /**
   * @description Gets the progress list for a specific study. (Admin/Leader/Member only)
   * @param id The ID of the study.
   * @returns A promise that resolves to a list of the study's progress entries.
   */
  @Get(':id/progress')
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER, StudyMemberRole.MEMBER)
  async findProgressByStudyId(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyProgressResponseDto[]> {
    return this.studyService.findProgressByStudyId(id);
  }

  /**
   * @description Adds a new progress entry to a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param createProgressDto The data for the new progress entry.
   * @returns A promise that resolves to the created progress entry's ID.
   */
  @Post(':id/progress')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async createProgress(
    @Param('id', ParseIntPipe) id: number,
    @Body() createProgressDto: CreateProgressDto,
  ): Promise<CreateProgressResponseDto> {
    return this.studyService.createProgress(id, createProgressDto);
  }

  /**
   * @description Updates a specific progress entry. (Admin/Leader only)
   * @param id The ID of the study.
   * @param progressId The ID of the progress entry to update.
   * @param updateProgressDto The data for the update.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Patch(':id/progress/:progressId')
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async updateProgress(
    @Param('id', ParseIntPipe) id: number,
    @Param('progressId', ParseIntPipe) progressId: number,
    @Body() updateProgressDto: UpdateProgressDto,
  ): Promise<SuccessResponseDto> {
    return this.studyService.updateProgress(id, progressId, updateProgressDto);
  }

  /**
   * @description Deletes a specific progress entry. (Admin/Leader only)
   * @param id The ID of the study.
   * @param progressId The ID of the progress entry to delete.
   * @returns A success response.
   */
  @Delete(':id/progress/:progressId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async deleteProgress(
    @Param('id', ParseIntPipe) id: number,
    @Param('progressId', ParseIntPipe) progressId: number,
  ): Promise<SuccessResponseDto> {
    return this.studyService.deleteProgress(id, progressId);
  }

  /**
   * @description Gets the resource list for a specific study. (Admin/Leader/Member only)
   * @param id The ID of the study.
   * @returns A promise that resolves to a list of the study's resources.
   */
  @Get(':id/resources')
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER, StudyMemberRole.MEMBER)
  async findResourcesByStudyId(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyResourceResponseDto[]> {
    return this.studyService.findResourcesByStudyId(id);
  }

  /**
   * @description Uploads a resource file for a study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param file The uploaded file.
   * @returns A promise that resolves to the created resource's information.
   */
  @Post(':id/resources')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadResource(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB limit
          new FileTypeValidator({ fileType: /(pdf|docx|pptx)$/ }), // pdf, docx, pptx allowed
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<StudyResourceResponseDto> {
    return await this.studyService.uploadResource(id, file);
  }

  /**
   * @description Deletes a specific resource from a study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param resourceId The ID of the resource to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Delete(':id/resources/:resourceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async deleteResource(
    @Param('id', ParseIntPipe) id: number,
    @Param('resourceId', ParseIntPipe) resourceId: number,
  ): Promise<SuccessResponseDto> {
    return this.studyService.deleteResource(id, resourceId);
  }

  /**
   * @description Searches for users available to be added to a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param query The DTO containing the search keyword.
   * @returns A promise that resolves to a list of found users.
   */
  @Get(':id/available-members')
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async searchAvailableMembers(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: SearchAvailableMembersQueryDto,
  ): Promise<SearchAvailableMembersResponseDto[]> {
    return this.studyService.searchAvailableMembers(id, query.search);
  }

  /**
   * @description Allows a member to apply to a study. The user will be added with PENDING status.
   * @param id The ID of the study to apply to.
   * @param req The request object containing the authenticated user.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Post(':id/apply')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MEMBER, UserRole.ADMIN)
  async apply(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ): Promise<SuccessResponseDto> {
    const userId = req.user.userId;
    return this.studyService.applyToStudy(id, userId);
  }

  /**
   * @description Approves a pending study applicant, changing their role to MEMBER. (Admin/Leader only)
   * @param id The ID of the study.
   * @param userId The ID of the user to approve.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Patch(':id/members/:userId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), StudyRolesGuard)
  @StudyRoles(StudyMemberRole.LEADER)
  async approveMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<SuccessResponseDto> {
    return this.studyService.approveMember(id, userId);
  }

  /**
   * @description Allows a member to leave a study on their own.
   * @param id The ID of the study to leave.
   * @param req The request object containing the authenticated user.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Delete(':id/leave')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async leave(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ): Promise<SuccessResponseDto> {
    const userId = req.user.userId;
    return this.studyService.leaveStudy(id, userId);
  }
}
