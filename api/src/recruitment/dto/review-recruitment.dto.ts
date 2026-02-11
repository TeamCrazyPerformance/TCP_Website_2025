import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ReviewStatus } from '../entities/enums/review-status.enum';

// 검토 의견 저장용 DTO
export class ReviewCommentDto {
    @IsString()
    @IsNotEmpty()
    review_comment: string;
}

// 심사 결정용 DTO
export class ReviewDecisionDto {
    @IsEnum(ReviewStatus)
    @IsNotEmpty()
    review_status: ReviewStatus;
}
