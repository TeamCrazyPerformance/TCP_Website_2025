import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, JoinColumn
} from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { TeamStatus } from './enums/team-status.enum';
import { ExecutionType } from './enums/execution-type.enum';
import { TeamRole } from './team-role.entity';
import { TeamMember } from './team-member.entity';

@Entity('team')
export class Team {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'leader_id' })
    leader: User | null;   

    @Column({ type: 'varchar', length: 255 })
    title: string;  

    @Column({ type: 'varchar', length: 100})
    category: string;   

    @Column({ type: 'date', name: 'period_start'})
    periodStart: Date;    

    @Column({ type: 'date', name: 'period_end' })
    periodEnd: Date;  

    @Column({ type: 'date' })
    deadline: Date;   

    @Column({ type: 'text' })
    description: string;    

    @Column({ type: 'varchar', length: 255, name: 'tech_stack', nullable: true })
    techStack?: string;  

    @Column({ type: 'varchar', length: 100, nullable: true })
    tag?: string;

    @Column({ type: 'text', nullable: true })
    goals?: string;  

    @Column({ type: 'enum', enum: ExecutionType, name: 'execution_type', default: ExecutionType.ONLINE })
    executionType: ExecutionType;  

    @Column({ type: 'varchar', length: 255, name: 'selection_proc', nullable: true })
    selectionProc?: string;  

    @Column({ type: 'varchar', length: 255, nullable: true })
    link?: string;  

    @Column({ type: 'varchar', length: 255})
    contact: string; 
    
    @Column({ type: 'enum', enum: TeamStatus, default: TeamStatus.OPEN })
    status: TeamStatus;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;    

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ type: 'varchar', length: 255, name: 'project_image', nullable: true })
    projectImage?: string; 

    @OneToMany(() => TeamRole, (role) => role.team)
    roles: TeamRole[];  

    @OneToMany(() => TeamMember, (member) => member.team)
    members: TeamMember[];  
}
