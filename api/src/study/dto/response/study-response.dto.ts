export class StudyResponseDto {
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
  leader_name: string | null;
  members_count: number;
}
