import { IsInt } from "class-validator";

export class ApplyTeamDto {
    @IsInt()
    roleId: number;
}
