import { IsEnum } from "class-validator";
import { TeamStatus } from '../entities/enums/team-status.enum';
export class UpdateTeamStatusDto {
    @IsEnum(TeamStatus, {message: 'status must be a valid TeamStatus value'})
    status: TeamStatus;
}
