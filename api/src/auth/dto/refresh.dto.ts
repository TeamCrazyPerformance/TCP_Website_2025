import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
    @IsString()
    @IsNotEmpty({ message: 'refresh_token을 입력해주세요.' })
    refresh_token: string;
}
