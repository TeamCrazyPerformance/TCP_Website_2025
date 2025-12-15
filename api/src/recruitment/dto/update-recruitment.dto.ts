import { PartialType } from '@nestjs/mapped-types';
import { CreateRecruitmentDto } from './create-recruitment.dto';

// PartialType을 사용해 CreateRecruitmentDto의 모든 속성을 선택 사항으로 만듦.
export class UpdateRecruitmentDto extends PartialType(CreateRecruitmentDto) {}
