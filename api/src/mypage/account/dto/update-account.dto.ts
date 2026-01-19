import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  Matches,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @Matches(/^010-\d{4}-\d{4}$/, {
    message: 'Invalid phone number format (required: 010-1234-5678)',
  })
  phone_number?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
