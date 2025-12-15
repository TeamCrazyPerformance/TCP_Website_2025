import { 
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { Team } from './team.entity';
import { TeamRole } from './team-role.entity';

@Entity('team_member')
@Unique(['user', 'team'])          
export class TeamMember {
    @PrimaryGeneratedColumn()
    id: number;

    // 지원자
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    // 지원한 팀
    @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team_id' })
    team: Team;

    // 지원한 역할
    @ManyToOne(() => TeamRole, (role) => role.members, {onDelete: 'SET NULL', nullable: true})
    @JoinColumn({ name: 'team_role_id' })
    role: TeamRole | null;

    // 팀장 여부
    @Column({ type: 'boolean', name: 'is_leader', default: false })
    isLeader: boolean;

}
