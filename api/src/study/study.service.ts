import * as path from 'path';
import * as fs from 'fs';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { UserRole } from '../members/entities/enums/user-role.enum';
import { StudyMember } from './entities/study-member.entity';
import { StudyMemberRole } from './entities/enums/study-member-role.enum';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';

// DTOs
import { CreateStudyDto } from './dto/request/create-study.dto';
import { UpdateStudyDto } from './dto/request/update-study.dto';
import { StudyResponseDto } from './dto/response/study-response.dto';
import { StudyDetailResponseDto } from './dto/response/study-detail-response.dto';
import { CreateStudyResponseDto } from './dto/response/create-study-response.dto';
import { SuccessResponseDto } from './dto/response/success-response.dto';
import { StudyMemberResponseDto } from './dto/response/study-member.response.dto';
import { StudyMemberDetailResponseDto } from './dto/response/study-member-detail.response.dto';
import { StudyProgressResponseDto } from './dto/response/study-progress.response.dto';
import { CreateProgressResponseDto } from './dto/response/create-progress-response.dto';
import { CreateProgressDto } from './dto/request/create-progress.dto';
import { UpdateProgressDto } from './dto/request/update-progress.dto';
import { StudyResourceResponseDto } from './dto/response/study-resource.response.dto';
import { SearchAvailableMembersResponseDto } from './dto/response/search-available-members-response.dto';

@Injectable()
export class StudyService {
  constructor(
    @InjectRepository(Study)
    private readonly studyRepository: Repository<Study>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StudyMember)
    private readonly studyMemberRepository: Repository<StudyMember>,
    @InjectRepository(Progress)
    private readonly progressRepository: Repository<Progress>,
    @InjectRepository(Resource)
    private readonly resourceRepository: Repository<Resource>,
  ) { }

  /**
   * @description Retrieves a list of studies, with an option to filter by year.
   * @param year The optional year to filter the studies by.
   * @returns A promise that resolves to an array of study summary DTOs.
   */
  async findAll(year?: number): Promise<StudyResponseDto[]> {
    // Define the options for the database query.
    const findOptions = {
      // 'relations' tells TypeORM to also load the related entities.
      // Here, we are asking for the 'studyMembers' of each study,
      // and for each 'studyMember', we also want the associated 'user'.
      // This allows us to get all the data we need in a single query.
      relations: ['studyMembers', 'studyMembers.user'],
      where: {},
    };

    // If a 'year' was provided as an argument...
    if (year) {
      // ...add a condition to the 'where' clause to filter by that start year.
      findOptions.where = { start_year: year };
    }

    // Execute the query to find all studies that match the findOptions.
    // The 'studies' variable will be an array of Study entities.
    const studies = await this.studyRepository.find(findOptions);

    // Transform (map) the array of Study entities into an array of StudyResponseDto objects.
    return studies.map((study) => {
      // For each study, search its 'studyMembers' array to find the entry where role is LEADER.
      const leaderMember = study.studyMembers.find(
        (member) => member.role === StudyMemberRole.LEADER && member.user,
      );

      // Safely get the leader's name. If no leader was found or user is deleted, this will be null.
      return {
        id: study.id,
        study_name: study.study_name,
        start_year: study.start_year,
        study_description: study.study_description,
        tag: study.tag,
        recruit_count: study.recruit_count,
        period: study.period,
        apply_deadline: study.apply_deadline,
        place: study.place,
        way: study.way,
        leader_name: leaderMember?.user?.name ?? null,
        // The total member count is the total number of studyMembers associated with the study, excluding PENDING members.
        members_count: study.studyMembers.filter(
          (member) => member.role !== StudyMemberRole.PENDING,
        ).length,
      };
    });
  }

  /**
   * @description Retrieves detailed information for a specific study by its ID.
   * @param id The ID of the study to retrieve.
   * @returns A promise that resolves to a detailed DTO of the study.
   */
  async findById(id: number): Promise<StudyDetailResponseDto> {
    // 1. Fetch the study and all its related data in a single query.
    const study = await this.studyRepository.findOne({
      where: { id },
      relations: ['studyMembers', 'studyMembers.user', 'resources', 'progress'],
    });

    // 2. If the study doesn't exist, throw a 404 Not Found error.
    if (!study) {
      throw new NotFoundException('Study not found');
    }

    // 3. Process the 'studyMembers' array.
    // Ensure we only work with members that have a valid user relation
    const validMembers = study.studyMembers.filter((m) => m && m.user);
    const leaderMember = validMembers.find((member) => member.role === StudyMemberRole.LEADER);
    const visibleMembers = validMembers;

    // 4. Map the entity data to the shape required by the API response DTO.
    return {
      id: study.id,
      study_name: study.study_name,
      start_year: study.start_year,
      study_description: study.study_description,
      tag: study.tag,
      recruit_count: study.recruit_count,
      period: study.period,
      apply_deadline: study.apply_deadline,
      place: study.place,
      way: study.way,
      leader: leaderMember
        ? {
          user_id: leaderMember.user.id,
          name: leaderMember.user.name,
          role: StudyMemberRole.LEADER,
        }
        : null,
      members: visibleMembers.map((member) => ({
        user_id: member.user.id,
        name: member.user.name,
        role: member.role,
        profile_image: member.user.profile_image && !member.user.profile_image.startsWith('http')
          ? `/profiles/${member.user.profile_image}`
          : member.user.profile_image,
      })),
      resources: study.resources
        .filter((r) => r.deleted_at === null)
        .map((r) => ({
          id: r.id,
          name: r.name,
          format: r.format,
          dir_path: r.dir_path,
        })),
      progress: study.progress.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
      })),
    };
  }

  /**
   * @description Creates a new study and assigns a leader.
   * @param createStudyDto The data for creating the new study.
   * @returns A promise resolving to an object with the success status and the new study's ID.
   */
  async create(
    createStudyDto: CreateStudyDto,
  ): Promise<CreateStudyResponseDto> {
    const { leader_id, ...studyData } = createStudyDto;

    // 1. Validate that the user designated as leader exists.
    const leader = await this.userRepository.findOneBy({ id: leader_id });
    if (!leader) {
      throw new BadRequestException(`Leader with ID "${leader_id}" not found.`);
    }

    // 2. Create and save the main Study entity.
    const newStudy = this.studyRepository.create(studyData);
    const savedStudy = await this.studyRepository.save(newStudy);

    // 3. Create a new StudyMember to link the leader to the new study.
    const leaderMember = this.studyMemberRepository.create({
      study: savedStudy,
      user: leader,
      role: StudyMemberRole.LEADER,
    });
    await this.studyMemberRepository.save(leaderMember);

    return { success: true, id: savedStudy.id };
  }

  /**
   * @description Updates an existing study's information.
   * @param id The ID of the study to update.
   * @param updateStudyDto The data to update.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async updateStudy(
    id: number,
    updateStudyDto: UpdateStudyDto,
  ): Promise<SuccessResponseDto> {
    // 1. Validate that at least one field has a meaningful value
    const hasValidFields = Object.entries(updateStudyDto).some(
      ([, value]) => value !== undefined && value !== null && value !== '',
    );

    if (!hasValidFields) {
      throw new BadRequestException(
        'At least one field to update must be provided.',
      );
    }

    // 2. Find the study to ensure it exists
    const study = await this.studyRepository.findOneBy({ id });
    if (!study) {
      throw new NotFoundException(`Study with ID "${id}" not found`);
    }

    // 3. Merge the changes from the DTO into the found entity and save
    Object.assign(study, updateStudyDto);
    await this.studyRepository.save(study);

    return { success: true };
  }

  /**
   * @description Deletes a study by its ID. (Admin only)
   * @param id The ID of the study to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async delete(id: number): Promise<SuccessResponseDto> {
    // 1. Attempt to delete the study directly by its primary key (ID).
    const deleteResult = await this.studyRepository.delete(id);

    // 2. Check the result to see if any rows were actually deleted.
    // If 'affected' is 0, no study with that ID was found.
    if (deleteResult.affected === 0) {
      throw new NotFoundException('Study not found');
    }

    // 3. If deletion was successful, return the success response.
    return { success: true };
  }

  /** 5
   * @description Finds a study by ID and returns a formatted list of its members (including the leader).
   * @param id The ID of the study.
   * @returns A promise that resolves to an array of DTOs, each representing a member of the study.
   */
  async findMembersByStudyId(id: number): Promise<StudyMemberResponseDto[]> {
    // 1. Find the study and eager-load its studyMembers and the user for each member.
    const study = await this.studyRepository.findOne({
      where: { id },
      relations: ['studyMembers', 'studyMembers.user'],
    });

    // 2. If the study doesn't exist, throw a 404 error.
    if (!study) {
      throw new NotFoundException('Study not found');
    }

    // 3. Map the array of StudyMember entities to an array of StudyMemberResponseDto.
    // Handle deleted users gracefully
    return study.studyMembers.map((member) => ({
      user_id: member.user?.id ?? 'deleted',
      name: member.user?.name ?? '탈퇴한 유저',
      role: member.role,
    }));
  }

  /**
   * @description Finds a specific member's detailed information in a study. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param userId The ID of the user to get details for.
   * @returns A promise that resolves to a DTO with detailed member information.
   */
  async findMemberDetailByStudyId(
    studyId: number,
    userId: string,
  ): Promise<StudyMemberDetailResponseDto> {
    // 1. Find the specific study member
    const studyMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
      relations: ['user'],
    });

    if (!studyMember) {
      throw new NotFoundException(
        `Member with ID "${userId}" not found in study with ID "${studyId}"`,
      );
    }

    // 2. Return detailed member information (handle deleted user)
    const user = studyMember.user;
    return {
      user_id: user?.id ?? 'deleted',
      name: user?.name ?? '탈퇴한 유저',
      role: studyMember.role,
      student_number: user?.student_number ?? null,
      phone_number: user?.phone_number ?? null,
      email: user?.email ?? null,
      major: user?.major ?? null,
      profile_image: user?.profile_image ?? null,
    };
  }

  /**
   * @description Updates the leader of a specific study.
   * @param studyId The ID of the study to update.
   * @param newLeaderId The ID of the user to be appointed as the new leader.
   * @returns A promise that resolves to a success DTO.
   */
  async updateLeader(
    studyId: number,
    newLeaderId: string,
  ): Promise<SuccessResponseDto> {
    // 1. Find the study and the user who will be the new leader.
    const study = await this.studyRepository.findOne({
      where: { id: studyId },
      relations: ['studyMembers', 'studyMembers.user'], // Eager load the members to find the current leader
    });
    if (!study)
      throw new NotFoundException('Study not found');

    const newLeader = await this.userRepository.findOneBy({ id: newLeaderId });
    if (!newLeader)
      throw new NotFoundException('User not found');

    // 2. Find the member entry for the current leader, if it exists.
    const currentLeaderMember = study.studyMembers.find((m) => m.role === StudyMemberRole.LEADER);

    if (currentLeaderMember) {
      // 3a. If a leader already exists, update the user on that member entry.
      currentLeaderMember.user = newLeader;
      await this.studyMemberRepository.save(currentLeaderMember);
    } else {
      // 3b. If no leader was previously assigned, create a new member entry.
      const newMember = this.studyMemberRepository.create({
        study: study,
        user: newLeader,
        role: StudyMemberRole.LEADER,
      });
      await this.studyMemberRepository.save(newMember);
    }

    return { success: true };
  }

  /**
   * @description Adds a user as a member to a study. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param userId The ID of the user to add.
   * @param role The role of the user (true = leader, false = member).
   * @returns A promise that resolves to a DTO indicating success.
   */
  async addMember(
    studyId: number,
    userId: string,
    role: StudyMemberRole,
  ): Promise<SuccessResponseDto> {
    // 1. Find the parent study and the user to be added to ensure they both exist.
    const study = await this.studyRepository.findOneBy({ id: studyId });
    if (!study)
      throw new NotFoundException('Study not found');

    const userToAdd = await this.userRepository.findOneBy({ id: userId });
    if (!userToAdd)
      throw new NotFoundException('User not found');

    // Check if user is GUEST
    if (userToAdd.role === UserRole.GUEST) {
      throw new BadRequestException('Guest users cannot be added to a study. Please approve the user to MEMBER first.');
    }

    // 2. Check if a member linking this user and study already exists to prevent duplicates.
    const existingMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
    });
    if (existingMember) {
      throw new ConflictException('User already exists in study');
    }

    // 3. Create a new StudyMember to link the user to the study and save it.
    const newMember = this.studyMemberRepository.create({
      study: study,
      user: userToAdd,
      role: role,
    });
    await this.studyMemberRepository.save(newMember);

    return { success: true };
  }

  /**
   * @description Removes a member from a specific study by deleting their StudyMember entry. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param userId The ID of the user to remove.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async removeMember(
    studyId: number,
    userId: string,
  ): Promise<SuccessResponseDto> {
    // 1. Find the specific StudyMember that links the user to the study.
    const memberToRemove = await this.studyMemberRepository.findOne({
      where: {
        study: { id: studyId },
        user: { id: userId },
      },
    });

    // 2. If no such member exists, the user is not a member of the study.
    if (!memberToRemove) {
      throw new NotFoundException('Member not found in study');
    }

    // 3. Delete the found StudyMember entity to remove the member.
    await this.studyMemberRepository.delete(memberToRemove.id);

    return { success: true };
  }

  /**
   * @description Finds all progress entries for a given study. (Admin/Leader/Member only)
   * @param studyId The ID of the study.
   * @returns A promise that resolves to an array of DTOs, each representing a progress entry.
   */
  async findProgressByStudyId(
    studyId: number,
  ): Promise<StudyProgressResponseDto[]> {
    // 1. Check if the study exists first
    const study = await this.studyRepository.findOneBy({ id: studyId });
    if (!study) {
      throw new NotFoundException(`Study with ID "${studyId}" not found`);
    }

    // 2. Find all progress entries linked to this study
    // 2. Find all progress entries linked to this study
    const progressEntries = await this.progressRepository.find({
      where: { study_id: { id: studyId } },
      relations: ['resources'],
      order: { week_no: 'ASC', created_at: 'DESC' },
    });

    // 3. Map the entities to DTOs
    return progressEntries.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      weekNo: p.week_no,
      progressDate: p.progress_date,
      resources: p.resources ? p.resources.map(r => ({
        id: r.id,
        name: r.name,
        format: r.format,
        dir_path: r.dir_path,
      })) : [],
    }));
  }

  /**
   * @description Creates a new progress entry for a specific study. (Admin/Leader only)
   * @param studyId The ID of the study to add progress to.
   * @param createProgressDto The data for the new progress entry.
   * @returns A promise that resolves to an object with the success status and the new entry's ID.
   */
  async createProgress(
    studyId: number,
    createProgressDto: CreateProgressDto,
  ): Promise<CreateProgressResponseDto> {
    // 1. Find the parent study to ensure it exists.
    const study = await this.studyRepository.findOneBy({ id: studyId });
    if (!study) {
      throw new NotFoundException(`Study with ID "${studyId}" not found`);
    }

    // 2. Create a new Progress entity instance with the provided data and link it to the study.
    const { resourceIds, weekNo, progressDate, ...progressData } = createProgressDto;

    const newProgress = this.progressRepository.create({
      ...progressData,
      week_no: weekNo,
      progress_date: progressDate,
      study_id: study,
    });

    // 3. Save the new progress entry to the database.
    const savedProgress = await this.progressRepository.save(newProgress);

    // 4. If resourceIds are provided, link them to this progress
    if (resourceIds && resourceIds.length > 0) {
      // Find resources that belong to this study and match the IDs
      const resourcesToUpdate = await this.resourceRepository.findByIds(resourceIds);

      // Filter resources to ensure they belong to the correct study (security check)
      const validResources = resourcesToUpdate.filter(r => r.study_id.id === studyId);

      if (validResources.length > 0) {
        // Update each resource to set the progress field
        for (const resource of validResources) {
          resource.progress = savedProgress;
          await this.resourceRepository.save(resource);
        }
      }
    }

    // 5. Return the success response with the new ID.
    return {
      success: true,
      id: savedProgress.id,
    };
  }

  /**
   * @description Updates a specific progress entry for a study. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param progressId The ID of the progress entry to update.
   * @param updateProgressDto The data to update.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async updateProgress(
    studyId: number,
    progressId: number,
    updateProgressDto: UpdateProgressDto,
  ): Promise<SuccessResponseDto> {
    // 1. Validate that at least one field has a meaningful value (not undefined)
    const hasValidFields = Object.entries(updateProgressDto).some(([key, value]) =>
      value !== undefined && value !== null && value !== ''
    );

    if (!hasValidFields) {
      throw new BadRequestException(
        'At least one field to update must be provided.',
      );
    }

    // 2. Find the specific progress entry that belongs to the specified study.
    const progressEntry = await this.progressRepository.findOneBy({
      id: progressId,
      study_id: { id: studyId },
    });

    // 3. If no matching entry is found, throw a 404 error.
    if (!progressEntry) {
      throw new NotFoundException(
        `Progress with ID "${progressId}" not found in study with ID "${studyId}"`,
      );
    }

    // 4. Merge the changes from the DTO into the found entity and save to the database.
    // 4. Merge the changes from the DTO into the found entity and save to the database.
    const { resourceIds, weekNo, progressDate, ...updateData } = updateProgressDto;

    if (weekNo !== undefined) progressEntry.week_no = weekNo;
    if (progressDate !== undefined) progressEntry.progress_date = progressDate;
    Object.assign(progressEntry, updateData);

    await this.progressRepository.save(progressEntry);

    // 5. If resourceIds are provided, link them to this progress
    // Note: This logic APPENDS or REPLACES? Usually it replaces or adds.
    // For simplicity, if resourceIds is passed, we check if we need to add them.
    // If we want to support removing resources, we might need a separate endpoint or logic.
    // Let's assume this just adds/links new resources for now, or use a "set" approach?
    // Given the simple form, let's treat it as "update these resources to point to this progress".
    if (resourceIds && resourceIds.length > 0) {
      const resourcesToUpdate = await this.resourceRepository.findByIds(resourceIds);
      const validResources = resourcesToUpdate.filter(r => r.study_id.id === studyId);

      for (const resource of validResources) {
        resource.progress = progressEntry;
        await this.resourceRepository.save(resource);
      }
    }

    return { success: true };
  }

  /**
   * @description Deletes a specific progress entry from a study. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param progressId The ID of the progress entry to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async deleteProgress(
    studyId: number,
    progressId: number,
  ): Promise<SuccessResponseDto> {
    // 1. Attempt to delete the progress entry that matches both the progressId and studyId.
    // This single query handles the validation that the progress belongs to the study.
    const deleteResult = await this.progressRepository.delete({
      id: progressId,
      study_id: { id: studyId },
    });

    // 2. If no rows were affected, it means the entry was not found in the specified study.
    if (deleteResult.affected === 0) {
      throw new NotFoundException(
        `Progress with ID "${progressId}" not found in study with ID "${studyId}"`,
      );
    }

    return { success: true };
  }

  /**
   * @description Finds all resources for a given study. (Admin/Leader/Member only)
   * @param studyId The ID of the study.
   * @returns A promise that resolves to an array of DTOs, each representing a resource.
   */
  async findResourcesByStudyId(
    studyId: number,
  ): Promise<StudyResourceResponseDto[]> {
    // 1. First, validate that the study exists.
    const study = await this.studyRepository.findOneBy({ id: studyId });
    if (!study) {
      throw new NotFoundException('Study not found');
    }

    // 2. Find all resource entries that are linked to this study ID and not deleted.
    const resources = await this.resourceRepository.find({
      where: { study_id: { id: studyId }, deleted_at: IsNull() },
    });

    // 3. Map the array of Resource entities to the response DTO format.
    return resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      format: resource.format,
      dir_path: resource.dir_path,
    }));
  }

  /**
   * @description Creates a resource record from an uploaded file. (Admin/Leader only)
   * @param studyId The ID of the study to which the resource will be added.
   * @param file The file object provided by Multer.
   * @returns A promise that resolves to the DTO of the created resource.
   */
  async uploadResource(
    studyId: number,
    file: Express.Multer.File,
  ): Promise<StudyResourceResponseDto> {
    // 1. Validate that the study exists.
    const study = await this.studyRepository.findOneBy({ id: studyId });
    if (!study) {
      throw new NotFoundException(`Study with ID "${studyId}" not found`);
    }

    // 2. Create a new Resource entity in memory using details from the uploaded file.
    const newResource = this.resourceRepository.create({
      name: file.originalname,
      format: path.extname(file.originalname).toUpperCase().replace('.', ''), // e.g., 'PDF'
      dir_path: file.path,
      study_id: study,
    });

    // 3. Save the new resource record to the database.
    const savedResource = await this.resourceRepository.save(newResource);

    // 4. Map the saved entity to the response DTO.
    return {
      id: savedResource.id,
      name: savedResource.name,
      format: savedResource.format,
      dir_path: savedResource.dir_path,
    };
  }

  /**
   * @description Soft deletes a specific resource from a study. (Admin/Leader only)
   * The actual file will be deleted after 7 days by a scheduled cleanup job.
   * @param studyId The ID of the study.
   * @param resourceId The ID of the resource to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async deleteResource(
    studyId: number,
    resourceId: number,
  ): Promise<SuccessResponseDto> {
    // 1. Find the resource that matches both IDs and is not already deleted.
    const resource = await this.resourceRepository.findOne({
      where: {
        id: resourceId,
        study_id: { id: studyId },
        deleted_at: IsNull(),
      },
    });

    // 2. If no resource was found, throw not found exception.
    if (!resource) {
      throw new NotFoundException(
        `Resource with ID "${resourceId}" not found in study with ID "${studyId}"`,
      );
    }

    // 3. Soft delete by setting deleted_at timestamp.
    resource.deleted_at = new Date();
    await this.resourceRepository.save(resource);

    return { success: true };
  }

  /**
   * @description Downloads a specific resource file from a study. (Admin/Leader/Member only)
   * @param studyId The ID of the study.
   * @param resourceId The ID of the resource to download.
   * @param res The Express response object to set headers.
   * @returns A StreamableFile of the resource.
   */
  async downloadResource(
    studyId: number,
    resourceId: number,
    res: Response,
  ): Promise<StreamableFile> {
    // 1. Find the resource that matches both IDs and is not deleted.
    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId, study_id: { id: studyId }, deleted_at: IsNull() },
    });

    if (!resource) {
      throw new NotFoundException(
        `Resource with ID "${resourceId}" not found in study with ID "${studyId}"`,
      );
    }

    // 2. Verify that the file exists on the filesystem.
    if (!fs.existsSync(resource.dir_path)) {
      throw new NotFoundException('Resource file not found on server');
    }

    // 3. Create a read stream for the file.
    const fileStream = fs.createReadStream(resource.dir_path);

    // 4. Set response headers for file download.
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(resource.name)}"`,
    });

    // 5. Return the file as a StreamableFile.
    return new StreamableFile(fileStream);
  }

  /**
   * @description Searches for users by a keyword, excluding any who are already members of a specific study. (Admin/Leader only)
   * @param studyId The ID of the study for which to exclude existing members.
   * @param search The keyword to search for in user names and emails.
   * @returns A promise that resolves to a list of found users.
   */
  async searchAvailableMembers(
    studyId: number,
    search: string,
  ): Promise<SearchAvailableMembersResponseDto[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // 1. Search by name or email (case-insensitive)
    queryBuilder.where(
      '(user.name ILIKE :search OR user.email ILIKE :search)',
      { search: `%${search}%` },
    );

    // 2. Exclude users who are already in the specified study
    queryBuilder.andWhere(
      'user.id NOT IN (SELECT "user_id" FROM "StudyMember" WHERE "study_id" = :studyId)',
      { studyId },
    );

    // 3. Exclude GUEST users - only MEMBER and ADMIN can be added to studies
    queryBuilder.andWhere('user.role != :guestRole', { guestRole: 'GUEST' });

    const users = await queryBuilder.getMany();

    // 4. Map the results to the response DTO
    return users.map((user) => ({
      user_id: user.id,
      name: user.name,
      email: user.email,
    }));
  }

  /**
   * @description Allows a member to apply to a study with pending status.
   * @param studyId The ID of the study to apply to.
   * @param userId The ID of the user applying.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async applyToStudy(
    studyId: number,
    userId: string,
  ): Promise<SuccessResponseDto> {
    // 1. Find the study to ensure it exists
    const study = await this.studyRepository.findOneBy({ id: studyId });
    if (!study) {
      throw new NotFoundException(`Study with ID "${studyId}" not found`);
    }

    // 2. Find the user to ensure they exist
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    if (user.role === UserRole.GUEST) {
      throw new BadRequestException('Guest users cannot apply to a study. Please request approval to MEMBER first.');
    }

    // 3. Check if the user is already a member of the study (in any role)
    const existingMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
    });
    if (existingMember) {
      throw new ConflictException('You have already applied to or are a member of this study');
    }

    // 4. Create a new StudyMember with PENDING role
    const newMember = this.studyMemberRepository.create({
      study: study,
      user: user,
      role: StudyMemberRole.PENDING,
    });
    await this.studyMemberRepository.save(newMember);

    return { success: true };
  }

  /**
   * @description Approves a pending study applicant, changing their role from PENDING to MEMBER.
   * @param studyId The ID of the study.
   * @param userId The ID of the user to approve.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async approveMember(
    studyId: number,
    userId: string,
  ): Promise<SuccessResponseDto> {
    // 1. Find the study with its members
    const study = await this.studyRepository.findOne({
      where: { id: studyId },
      relations: ['studyMembers'],
    });

    if (!study) {
      throw new NotFoundException(`Study with ID "${studyId}" not found`);
    }

    // 2. Find the study member entry
    const studyMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
    });

    if (!studyMember) {
      throw new NotFoundException(
        `User with ID "${userId}" is not found in study with ID "${studyId}"`,
      );
    }

    // 3. Verify the member is in PENDING status
    if (studyMember.role !== StudyMemberRole.PENDING) {
      throw new BadRequestException(
        'Only pending applicants can be approved',
      );
    }

    // 4. Check if recruit_count limit is reached (only count LEADER + MEMBER, not PENDING)
    const currentMemberCount = study.studyMembers.filter(
      (m) => m.role === StudyMemberRole.LEADER || m.role === StudyMemberRole.MEMBER,
    ).length;

    if (study.recruit_count && currentMemberCount >= study.recruit_count) {
      throw new BadRequestException(
        `모집 인원(${study.recruit_count}명)이 이미 꽉 찼습니다.`,
      );
    }

    // 5. Update the role to MEMBER
    studyMember.role = StudyMemberRole.MEMBER;
    await this.studyMemberRepository.save(studyMember);

    return { success: true };
  }

  /**
   * @description Allows a member to leave a study on their own.
   * @param studyId The ID of the study to leave.
   * @param userId The ID of the user leaving.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async leaveStudy(
    studyId: number,
    userId: string,
  ): Promise<SuccessResponseDto> {
    // 1. Find the study member entry
    const studyMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
      relations: ['study', 'study.studyMembers'],
    });

    if (!studyMember) {
      throw new NotFoundException(
        'You are not a member of this study',
      );
    }

    // 2. Leaders cannot leave if they are the last one
    if (studyMember.role === StudyMemberRole.LEADER) {
      const leaderCount = studyMember.study.studyMembers.filter(
        (m) => m.role === StudyMemberRole.LEADER
      ).length;

      if (leaderCount <= 1) {
        throw new BadRequestException(
          'Last leader cannot leave the study. Please promote another leader first.',
        );
      }
    }

    // 3. Delete the study member entry
    await this.studyMemberRepository.delete(studyMember.id);

    return { success: true };
  }

  /**
   * @description Nominates a member to become a leader. (Admin/Leader only)
   */
  async nominateLeader(
    studyId: number,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const studyMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
    });

    if (!studyMember) {
      throw new NotFoundException('Member not found');
    }

    if (studyMember.role === StudyMemberRole.LEADER) {
      throw new BadRequestException('User is already a leader');
    }

    if (studyMember.role !== StudyMemberRole.MEMBER) {
      throw new BadRequestException('Only active members can be nominated');
    }

    studyMember.role = StudyMemberRole.NOMINEE;
    await this.studyMemberRepository.save(studyMember);

    return { success: true };
  }

  /**
   * @description Accepts the leadership nomination. (Nominee only)
   */
  async acceptLeaderNomination(
    studyId: number,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const studyMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
    });

    if (!studyMember) {
      throw new NotFoundException('Member not found');
    }

    if (studyMember.role !== StudyMemberRole.NOMINEE) {
      throw new BadRequestException('You are not nominated for leadership');
    }

    studyMember.role = StudyMemberRole.LEADER;
    await this.studyMemberRepository.save(studyMember);

    return { success: true };
  }

  /**
   * @description Declines the leadership nomination. (Nominee only)
   */
  async declineLeaderNomination(
    studyId: number,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const studyMember = await this.studyMemberRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
    });

    if (!studyMember) {
      throw new NotFoundException('Member not found');
    }

    if (studyMember.role !== StudyMemberRole.NOMINEE) {
      throw new BadRequestException('You are not nominated for leadership');
    }

    studyMember.role = StudyMemberRole.MEMBER;
    await this.studyMemberRepository.save(studyMember);

    return { success: true };
  }
}
