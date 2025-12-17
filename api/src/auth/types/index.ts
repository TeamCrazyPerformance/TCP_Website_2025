import { UserRole } from '../../members/entities/enums/user-role.enum';
export type JwtPayload = { sub: number; username: string; role: UserRole };
export type RefreshPayload = { sub: number; type: 'refresh' };

export type SanitizedUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  student_number: string;
  profile_image: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
};
