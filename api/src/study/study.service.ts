import * as path from 'path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Study } from './entities/study.entity';
import { User } from '../members/entities/user.entity';
import { Role } from './entities/role.entity';
import { Progress } from './entities/progress.entity';
import { Resource } from './entities/resource.entity';

// DTOs
import { CreateStudyDto } from './dto/request/create-study.dto';
import { StudyResponseDto } from './dto/response/study-response.dto';
import { StudyDetailResponseDto } from './dto/response/study-detail-response.dto';
import { CreateStudyResponseDto } from './dto/response/create-study-response.dto';
import { SuccessResponseDto } from './dto/response/success-response.dto';
import { StudyMemberResponseDto } from './dto/response/study-member.response.dto';
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
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Progress)
    private readonly progressRepository: Repository<Progress>,
    @InjectRepository(Resource)
    private readonly resourceRepository: Repository<Resource>,
  ) {}

  /** 1
   * @description Retrieves a list of studies, with an option to filter by year.
   * @param year The optional year to filter the studies by.
   * @returns A promise that resolves to an array of study summary DTOs.
   */
  async findAll(year?: number): Promise<StudyResponseDto[]> {
    // Define the options for the database query.
    const findOptions = {
      // 'relations' tells TypeORM to also load the related entities.
      // Here, we are asking for the 'roles' of each study,
      // and for each 'role', we also want the associated 'user'.
      // This allows us to get all the data we need in a single query.
      relations: ['roles', 'roles.user_id'],
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
      // For each study, search its 'roles' array to find the entry where the role name is 'Leader'.
      const leaderRole = study.roles.find(
        (role) => role.role_name === 'Leader',
      );

      // Construct and return the DTO object with the required shape.
      return {
        id: study.id,
        study_name: study.study_name,
        start_year: study.start_year,
        study_description: study.study_description,
        // Safely get the leader's name. If no leader role was found, this will be null.
        leader_name: leaderRole ? leaderRole.user_id.name : null,
        // The total member count is the total number of roles associated with the study.
        members_count: study.roles.length,
      };
    });
  }

  /** 2
   * @description Retrieves detailed information for a specific study by its ID.
   * @param id The ID of the study to retrieve.
   * @returns A promise that resolves to a detailed DTO of the study.
   */
  async findById(id: number): Promise<StudyDetailResponseDto> {
    // 1. Fetch the study and all its related data in a single query.
    const study = await this.studyRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.user_id', 'resources', 'progress'],
    });

    // 2. If the study doesn't exist, throw a 404 Not Found error.
    if (!study) {
      throw new NotFoundException('Study not found');
    }

    // 3. Process the 'roles' array to separate the leader from the members.
    const leaderRole = study.roles.find((role) => role.role_name === 'Leader');
    const memberRoles = study.roles.filter(
      (role) => role.role_name === 'member',
    );

    // 4. Map the entity data to the shape required by the API response DTO.
    return {
      id: study.id,
      study_name: study.study_name,
      start_year: study.start_year,
      study_description: study.study_description,
      leader: leaderRole
        ? {
            user_id: leaderRole.user_id.id,
            name: leaderRole.user_id.name,
            role_name: 'Leader',
          }
        : null,
      members: memberRoles.map((role) => ({
        user_id: role.user_id.id,
        name: role.user_id.name,
        role_name: 'member',
      })),
      resources: study.resources.map((r) => ({
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

  /** 3
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

    // 3. Create a new Role to link the leader to the new study.
    const leaderRole = this.roleRepository.create({
      study_id: savedStudy,
      user_id: leader,
      role_name: 'Leader',
    });
    await this.roleRepository.save(leaderRole);

    return { success: true, id: savedStudy.id };
  }

  /** 4
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
    // 1. Find the study and eager-load its roles and the user for each role.
    const study = await this.studyRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.user_id'],
    });

    // 2. If the study doesn't exist, throw a 404 error.
    if (!study) {
      throw new NotFoundException('Study not found');
    }

    // 3. Map the array of Role entities to an array of StudyMemberResponseDto.
    return study.roles.map((role) => ({
      user_id: role.user_id.id,
      name: role.user_id.name,
      role_name: role.role_name,
    }));
  }

  /** 6
   * @description Updates the leader of a specific study.
   * @param studyId The ID of the study to update.
   * @param newLeaderId The ID of the user to be appointed as the new leader.
   * @returns A promise that resolves to a success DTO.
   */
  async updateLeader(
    studyId: number,
    newLeaderId: number,
  ): Promise<SuccessResponseDto> {
    // 1. Find the study and the user who will be the new leader.
    const study = await this.studyRepository.findOne({
      where: { id: studyId },
      relations: ['roles', 'roles.user_id'], // Eager load the roles to find the current leader
    });
    if (!study)
      throw new NotFoundException('Study not found');

    const newLeader = await this.userRepository.findOneBy({ id: newLeaderId });
    if (!newLeader)
      throw new NotFoundException('User not found');

    // 2. Find the role entry for the current leader, if it exists.
    const currentLeaderRole = study.roles.find((r) => r.role_name === 'Leader');

    if (currentLeaderRole) {
      // 3a. If a leader already exists, update the user on that role entry.
      currentLeaderRole.user_id = newLeader;
      await this.roleRepository.save(currentLeaderRole);
    } else {
      // 3b. If no leader was previously assigned, create a new role entry.
      const newRole = this.roleRepository.create({
        study_id: study,
        user_id: newLeader,
        role_name: 'Leader',
      });
      await this.roleRepository.save(newRole);
    }

    return { success: true };
  }

  /** 7
   * @description Adds a user as a member to a study. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param userId The ID of the user to add.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async addMember(
    studyId: number,
    userId: number,
    role_name: string,
  ): Promise<SuccessResponseDto> {
    // 1. Find the parent study and the user to be added to ensure they both exist.
    const study = await this.studyRepository.findOneBy({ id: studyId });
    if (!study)
      throw new NotFoundException('Study not found');

    const userToAdd = await this.userRepository.findOneBy({ id: userId });
    if (!userToAdd)
      throw new NotFoundException('User not found');

    // 2. Check if a role linking this user and study already exists to prevent duplicates.
    const existingRole = await this.roleRepository.findOne({
      where: { study_id: { id: studyId }, user_id: { id: userId } },
    });
    if (existingRole) {
      throw new ConflictException('User already exists in study');
    }

    // 3. Create a new 'Member' role to link the user to the study and save it.
    const newMemberRole = this.roleRepository.create({
      study_id: study,
      user_id: userToAdd,
      role_name: role_name,
    });
    await this.roleRepository.save(newMemberRole);

    return { success: true };
  }

  /** 8
   * @description Removes a member from a specific study by deleting their role. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param userId The ID of the user to remove.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async removeMember(
    studyId: number,
    userId: number,
  ): Promise<SuccessResponseDto> {
    // 1. Find the specific Role that links the user to the study.
    const roleToRemove = await this.roleRepository.findOne({
      where: {
        study_id: { id: studyId },
        user_id: { id: userId },
      },
    });

    // 2. If no such role exists, the user is not a member of the study.
    if (!roleToRemove) {
      throw new NotFoundException('Member not found in study');
    }

    // 3. Delete the found Role entity to remove the member.
    await this.roleRepository.delete(roleToRemove.id);

    return { success: true };
  }

  /** 9
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
    const progressEntries = await this.progressRepository.find({
      where: { study_id: { id: studyId } },
    });

    // 3. Map the entities to DTOs
    return progressEntries.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
    }));
  }

  /** 10
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
    const newProgress = this.progressRepository.create({
      ...createProgressDto,
      study_id: study,
    });

    // 3. Save the new progress entry to the database.
    const savedProgress = await this.progressRepository.save(newProgress);

    // 4. Return the success response with the new ID.
    return {
      success: true,
      id: savedProgress.id,
    };
  }

  /** 11
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
    Object.assign(progressEntry, updateProgressDto);
    await this.progressRepository.save(progressEntry);

    return { success: true };
  }

  /** 12
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

  /** 13
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

    // 2. Find all resource entries that are linked to this study ID.
    const resources = await this.resourceRepository.find({
      where: { study_id: { id: studyId } },
    });

    // 3. Map the array of Resource entities to the response DTO format.
    return resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      format: resource.format,
      dir_path: resource.dir_path,
    }));
  }

  /** 14
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

  /** 15
   * @description Deletes a specific resource from a study. (Admin/Leader only)
   * @param studyId The ID of the study.
   * @param resourceId The ID of the resource to delete.
   * @returns A promise that resolves to a DTO indicating success.
   */
  async deleteResource(
    studyId: number,
    resourceId: number,
  ): Promise<SuccessResponseDto> {
    // 1. Attempt to delete the resource that matches both IDs.
    // This single query validates that the resource belongs to the study.
    const deleteResult = await this.resourceRepository.delete({
      id: resourceId,
      study_id: { id: studyId },
    });

    // 2. If no rows were affected, the resource was not found.
    if (deleteResult.affected === 0) {
      throw new NotFoundException(
        `Resource with ID "${resourceId}" not found in study with ID "${studyId}"`,
      );
    }

    return { success: true };
  }

  /** 16
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
      'user.id NOT IN (SELECT "user_id" FROM "Role" WHERE "study_id" = :studyId)',
      { studyId },
    );

    const users = await queryBuilder.getMany();

    // 3. Map the results to the response DTO
    return users.map((user) => ({
      user_id: user.id,
      name: user.name,
      email: user.email,
    }));
  }
}
