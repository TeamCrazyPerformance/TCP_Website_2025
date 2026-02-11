import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Study } from './study.entity';
import { Progress } from './progress.entity';

@Entity('Resource')
export class Resource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  format: string;

  @Column({ type: 'text' })
  dir_path: string;

  @Column({ type: 'int', nullable: true })
  progress_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  deleted_at: Date | null;

  @ManyToOne(() => Study, (study) => study.resources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'study_id' })
  study_id: Study;

  @ManyToOne(() => Progress, (progress) => progress.resources, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'progress_id' })
  progress: Progress;
}
