import {
    IsArray,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    ValidateNested,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExecutionType } from '../entities/enums/execution-type.enum';

/** 역할 입력용 DTO */
export class CreateTeamRoleInput {
    @IsString()
    @IsNotEmpty()
    roleName: string;

    @IsInt()
    @Min(1)
    recruitCount: number;
}

export class CreateTeamDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    category: string;

    @IsDateString()
    @IsNotEmpty()
    periodStart: string;

    @IsDateString()
    @IsNotEmpty()
    periodEnd: string;

    @IsDateString()
    @IsNotEmpty()
    deadline: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsOptional()
    techStack?: string;

    @IsString()
    @IsOptional()
    tag?: string; 

    @IsString()
    @IsOptional()
    goals?: string;

    @IsEnum(ExecutionType)
    @IsOptional()
    executionType?: ExecutionType;

    @IsString()
    @IsOptional()
    selectionProc?: string;

    @IsUrl()
    @IsOptional()
    link?: string;

    @IsString()
    @IsNotEmpty()
    contact: string;

    @IsString()
    @IsOptional()
    projectImage?: string;

    /** 모집 역할 배열 */
    @IsArray({ message: 'At least one role is required' })
    @ValidateNested({ each: true })
    @Type(() => CreateTeamRoleInput)
    roles: CreateTeamRoleInput[];
}
