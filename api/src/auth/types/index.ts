export type JwtPayload = { sub: number; username: string };

export type SanitizedUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  student_number: string;
  profile_image: string;
  created_at: Date;
  updated_at: Date;
};
