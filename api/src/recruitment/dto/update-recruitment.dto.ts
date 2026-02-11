import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateRecruitmentDto } from './create-recruitment.dto';
import { ReviewStatus } from '../entities/enums/review-status.enum';

// PartialType을 사용해 CreateRecruitmentDto의 모든 속성을 선택 사항으로 만듦.
export class UpdateRecruitmentDto extends PartialType(CreateRecruitmentDto) {
    @IsOptional()
    @IsEnum(ReviewStatus)
    review_status?: ReviewStatus;

    @IsOptional()
    @IsString()
    review_comment?: string;
}
