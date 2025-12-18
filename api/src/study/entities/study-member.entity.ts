import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../../members/entities/user.entity';
import { Study } from './study.entity';
import { StudyMemberRole } from './enums/study-member-role.enum';

@Entity('StudyMember')
export class StudyMember {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 10, default: StudyMemberRole.PENDING })
    role: StudyMemberRole; // PENDING, MEMBER, LEADER

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @ManyToOne(() => User, (user) => user.studyMembers)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Study, (study) => study.studyMembers)
    @JoinColumn({ name: 'study_id' })
    study: Study;
}
