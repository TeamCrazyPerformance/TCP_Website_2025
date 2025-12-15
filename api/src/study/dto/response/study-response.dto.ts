export class StudyResponseDto {
  id: number;
  study_name: string;
  start_year: number;
  study_description: string;
  leader_name: string | null;
  members_count: number;
}
