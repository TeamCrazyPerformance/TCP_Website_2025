import { StudyMemberResponseDto } from './study-member.response.dto';
import { StudyProgressResponseDto } from './study-progress.response.dto';
import { StudyResourceResponseDto } from './study-resource.response.dto';

export class StudyDetailResponseDto {
  id: number;
  study_name: string;
  start_year: number;
  study_description: string | null;
  tag: string | null;
  recruit_count: number | null;
  period: string | null;
  apply_deadline: Date;
  place: string | null;
  way: string | null;
  leader: StudyMemberResponseDto | null;
  members: StudyMemberResponseDto[];
  resources: StudyResourceResponseDto[];
  progress: StudyProgressResponseDto[];
}
