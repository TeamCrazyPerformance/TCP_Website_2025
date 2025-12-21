import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Resume } from './resume.entity';

@Entity({ name: 'project' })
export class Project {
  @PrimaryGeneratedColumn({ comment: 'PK' })
  id: number;

  // FK column
  @Column({ name: 'resume_id', type: 'int', comment: 'FK' })
  resume_id: number;

  @ManyToOne(() => Resume, (resume) => resume.projects, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'resume_id' })
  resume: Resume;

  @Column({ type: 'varchar', length: 100, comment: '프로젝트명' })
  project_name: string;

  @Column({ type: 'text', comment: '참여율' })
  project_contribution: string;

  @Column({ type: 'date', comment: '발표년월' })
  project_date: string; // or Date

  @Column({ type: 'text', comment: '프로젝트 내용' })
  project_description: string;

  @Column({ type: 'text', comment: '사용 기술' })
  project_tech_stack: string;
}
