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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudyService } from './study.service';

import { GetStudiesQueryDto } from './dto/request/get-studies-query.dto';
import { CreateStudyDto } from './dto/request/create-study.dto';
import { UpdateStudyLeaderDto } from './dto/request/update-study-leader.dto';
import { AddStudyMemberDto } from './dto/request/add-study-member.dto';
import { SuccessResponseDto } from './dto/response/success-response.dto';
import { CreateStudyResponseDto } from './dto/response/create-study-response.dto';
import { StudyResponseDto } from './dto/response/study-response.dto';
import { StudyDetailResponseDto } from './dto/response/study-detail-response.dto';
import { StudyMemberResponseDto } from './dto/response/study-member.response.dto';
import { AddStudyMemberResponseDto } from './dto/response/add-study-member-response.dto';
import { StudyProgressResponseDto } from './dto/response/study-progress.response.dto';
import { CreateProgressDto } from './dto/request/create-progress.dto';
import { CreateProgressResponseDto } from './dto/response/create-progress-response.dto';
import { UpdateProgressDto } from './dto/request/update-progress.dto';
import { StudyResourceResponseDto } from './dto/response/study-resource.response.dto';
import { SearchAvailableMembersQueryDto } from './dto/request/search-available-members-query.dto';
import { SearchAvailableMembersResponseDto } from './dto/response/search-available-members-response.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/v1/study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  /** 1
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

  /** 2
   * @description Retrieves detailed information for a specific study.
   * @param id The ID of the study to retrieve.
   * @returns A promise that resolves to a detailed DTO of the study.
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyDetailResponseDto> {
    return this.studyService.findById(id);
  }

  /** 3
   * @description Creates a new study. (Admin only)
   * @param createStudyDto The data required to create a new study.
   * @returns A promise that resolves to an object containing the success status and the new study's ID.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  async create(
    @Body() createStudyDto: CreateStudyDto,
  ): Promise<CreateStudyResponseDto> {
    return this.studyService.create(createStudyDto);
  }

  /** 4
   * @description Deletes a specific study by its ID. (Admin only)
   * @param id The ID of the study to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async delete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SuccessResponseDto> {
    return this.studyService.delete(id);
  }

  /** 5
   * @description Retrieves the list of members for a specific study. (Admin/Leader/Member only)
   * @param id The ID of the study.
   * @returns A promise that resolves to an array of study member DTOs.
   */
  @Get(':id/members')
  @UseGuards(AuthGuard('jwt'))
  async findMembers(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyMemberResponseDto[]> {
    return this.studyService.findMembersByStudyId(id);
  }

  /** 6
   * @description Appoints or changes the leader of a study. (Admin only)
   * @param id The ID of the study to update.
   * @param updateStudyLeaderDto A DTO containing the new leader's user ID.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async updateLeader(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudyLeaderDto: UpdateStudyLeaderDto,
  ): Promise<SuccessResponseDto> {
    return this.studyService.updateLeader(id, updateStudyLeaderDto.user_id);
  }

  /** 7
   * @description Adds a new member to a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param addStudyMemberDto A DTO containing the user ID of the member to add.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  async addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() addStudyMemberDto: AddStudyMemberDto,
  ): Promise<AddStudyMemberResponseDto> {
    return this.studyService.addMember(
      id,
      addStudyMemberDto.user_id,
      addStudyMemberDto.role_name,
    );
  }

  /** 8
   * @description Removes a member from a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param userId The ID of the user to remove from the study.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<SuccessResponseDto> {
    return await this.studyService.removeMember(id, userId);
  }

  /** 9
   * @description Gets the progress list for a specific study. (Admin/Leader/Member only)
   * @param id The ID of the study.
   * @returns A promise that resolves to a list of the study's progress entries.
   */
  @Get(':id/progress')
  @UseGuards(AuthGuard('jwt'))
  async findProgressByStudyId(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyProgressResponseDto[]> {
    return this.studyService.findProgressByStudyId(id);
  }

  /** 10
   * @description Adds a new progress entry to a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param createProgressDto The data for the new progress entry.
   * @returns A promise that resolves to the created progress entry's ID.
   */
  @Post(':id/progress')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  async createProgress(
    @Param('id', ParseIntPipe) id: number,
    @Body() createProgressDto: CreateProgressDto,
  ): Promise<CreateProgressResponseDto> {
    return this.studyService.createProgress(id, createProgressDto);
  }

  /** 11
   * @description Updates a specific progress entry. (Admin/Leader only)
   * @param id The ID of the study.
   * @param progressId The ID of the progress entry to update.
   * @param updateProgressDto The data for the update.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Patch(':id/progress/:progressId')
  @UseGuards(AuthGuard('jwt'))
  async updateProgress(
    @Param('id', ParseIntPipe) id: number,
    @Param('progressId', ParseIntPipe) progressId: number,
    @Body() updateProgressDto: UpdateProgressDto,
  ): Promise<SuccessResponseDto> {
    return this.studyService.updateProgress(id, progressId, updateProgressDto);
  }

  /** 12
   * @description Deletes a specific progress entry. (Admin/Leader only)
   * @param id The ID of the study.
   * @param progressId The ID of the progress entry to delete.
   * @returns A success response.
   */
  @Delete(':id/progress/:progressId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async deleteProgress(
    @Param('id', ParseIntPipe) id: number,
    @Param('progressId', ParseIntPipe) progressId: number,
  ): Promise<SuccessResponseDto> {
    return this.studyService.deleteProgress(id, progressId);
  }

  /** 13
   * @description Gets the resource list for a specific study. (Admin/Leader/Member only)
   * @param id The ID of the study.
   * @returns A promise that resolves to a list of the study's resources.
   */
  @Get(':id/resources')
  @UseGuards(AuthGuard('jwt'))
  async findResourcesByStudyId(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StudyResourceResponseDto[]> {
    return this.studyService.findResourcesByStudyId(id);
  }

  /** 14
   * @description Uploads a resource file for a study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param file The uploaded file.
   * @returns A promise that resolves to the created resource's information.
   */
  @Post(':id/resources')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
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

  /** 15
   * @description Deletes a specific resource from a study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param resourceId The ID of the resource to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  @Delete(':id/resources/:resourceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async deleteResource(
    @Param('id', ParseIntPipe) id: number,
    @Param('resourceId', ParseIntPipe) resourceId: number,
  ): Promise<SuccessResponseDto> {
    return this.studyService.deleteResource(id, resourceId);
  }

  /** 16
   * @description Searches for users available to be added to a specific study. (Admin/Leader only)
   * @param id The ID of the study.
   * @param query The DTO containing the search keyword.
   * @returns A promise that resolves to a list of found users.
   */
  @Get(':id/available-members')
  @UseGuards(AuthGuard('jwt'))
  async searchAvailableMembers(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: SearchAvailableMembersQueryDto,
  ): Promise<SearchAvailableMembersResponseDto[]> {
    return this.studyService.searchAvailableMembers(id, query.search);
  }
}
