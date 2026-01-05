import { IsString, IsNotEmpty } from 'class-validator';

export class WithdrawDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}
