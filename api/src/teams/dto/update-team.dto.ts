import { Type } from "class-transformer";
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ExecutionType } from "../entities/enums/execution-type.enum";

export class UpdateTeamRoleDto {
    @IsInt()
    id: number;

    @IsString()
    @IsOptional()
    roleName?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    recruitCount?: number;

    @IsString()
    @IsOptional()
    action?: 'update' | 'delete'; 
}

export class AddTeamRoleDto {
    @IsString()
    roleName: string;

    @IsInt()
    @Min(1)
    recruitCount: number;
}

export class UpdateTeamDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsDateString()
    @IsOptional()
    periodStart?: string;

    @IsDateString()
    @IsOptional()
    periodEnd?: string;

    @IsDateString()
    @IsOptional()
    deadline?: string;

    @IsString()
    @IsOptional()
    description?: string;

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

    @IsString()
    @IsOptional()
    link?: string;

    @IsString()
    @IsOptional()
    contact?: string;

    @IsString()
    @IsOptional()
    projectImage?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateTeamRoleDto)
    @IsOptional()
    rolesToUpdate?: UpdateTeamRoleDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AddTeamRoleDto)
    @IsOptional()
    rolesToAdd?: AddTeamRoleDto[];
}
