import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class GetStudiesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer.' })
  year?: number;
}
