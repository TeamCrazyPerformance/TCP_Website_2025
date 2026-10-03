import type { StudyPeriodStatus } from '../../study-period';

export class CreateStudyResponseDto {
  success: boolean;
  id: number;
  status: StudyPeriodStatus;
}
