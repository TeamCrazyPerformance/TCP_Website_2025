import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';

@Entity('team_role')
export class TeamRole {
    @PrimaryGeneratedColumn()
    id: number;

    /** 어떤 팀에 속한 역할인지 */
    @ManyToOne(() => Team, (team) => team.roles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team_id' })
    team: Team;

    /** 역할 이름 (예: 프론트엔드, 백엔드, 디자이너) */
    @Column({ type: 'varchar', length: 100, name: 'role_name' })
    roleName: string;

    /** 모집 인원 */
    @Column({ type: 'int', name: 'recruit_count' })
    recruitCount: number;

    /** 현재 승인된 인원 수 */
    @Column({ type: 'int', name: 'current_count', default: 0 })
    currentCount: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    /** 이 역할에 지원한 팀원들 */
    @OneToMany(() => TeamMember, (member) => member.role)
    members: TeamMember[];
}
