import { IsString, Length, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: '아이디를 입력해주세요.' })
  @Length(3, 50, { message: '아이디 길이를 기준에 맞게 입력해주세요.' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  @Length(8, 255, { message: '비밀번호 길이를 기준에 맞게 입력해주세요.' })
  password: string;
}
