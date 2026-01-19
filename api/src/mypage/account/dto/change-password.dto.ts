import {
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class ChangePasswordDto {

  @IsString()
  currentPassword: string;

  // 비밀번호: 대문자, 소문자, 숫자, 특수문자 각 1개 이상 (register.dto와 동일)
  @IsString()
  @Length(8, 255)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    {
      message:
        '비밀번호는 대문자, 소문자, 숫자, 특수문자(@$!%*?&)를 각각 1개 이상 포함해야 합니다.',
    },
  )
  newPassword: string;

  @IsString()
  confirmPassword: string;
}
