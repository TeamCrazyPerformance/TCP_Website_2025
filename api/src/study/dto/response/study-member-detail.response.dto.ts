import { StudyMemberRole } from '../../entities/enums/study-member-role.enum';

export class StudyMemberDetailResponseDto {
    user_id: number;
    name: string;
    role: StudyMemberRole;
    student_number: string;
    phone_number: string;
    email: string;
    major: string;
    profile_image: string;
}
