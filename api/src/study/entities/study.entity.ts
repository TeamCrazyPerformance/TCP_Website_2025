import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { StudyMember } from './study-member.entity';
import { Progress } from './progress.entity';
import { Resource } from './resource.entity';

@Entity('Study')
export class Study {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  study_name: string;

  @Column({ type: 'smallint' })
  start_year: number;

  @Column({ type: 'text', nullable: true })
  study_description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tag: string;

  @Column({ type: 'int', nullable: true })
  recruit_count: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  period: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  apply_deadline: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  place: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  way: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => StudyMember, (studyMember) => studyMember.study)
  studyMembers: StudyMember[];

  @OneToMany(() => Progress, (progress) => progress.study_id)
  progress: Progress[];

  @OneToMany(() => Resource, (resource) => resource.study_id)
  resources: Resource[];
}
