import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from './user-role.enum';

export class GetUsersQueryDto {
  @IsOptional()
  @IsString()
  @IsEnum(UserRole)
  role?: UserRole;
}
