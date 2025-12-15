import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SearchAvailableMembersQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  search: string;
}
