import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Resume } from './resume.entity';

@Entity({ name: 'award' })
export class Award {
  @PrimaryGeneratedColumn({ comment: 'PK' })
  id: number;

  // FK column
  @Column({ name: 'resume_id', type: 'int', comment: 'FK' })
  resume_id: number;

  @ManyToOne(() => Resume, (resume) => resume.awards, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'resume_id' })
  resume: Resume;

  @Column({ type: 'varchar', length: 100, comment: '수상명' })
  award_name: string;

  @Column({ type: 'varchar', length: 100, comment: '수여 기관' })
  award_institution: string;

  @Column({ type: 'date', comment: '취득 년월' })
  award_date: string; // or Date

  @Column({ type: 'text', comment: '수상 내용' })
  award_description: string;
}
