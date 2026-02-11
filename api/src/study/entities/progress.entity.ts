import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Study } from './study.entity';
import { Resource } from './resource.entity';

@Entity('Progress')
export class Progress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'int', nullable: true })
  week_no: number;

  @Column({ type: 'timestamp', nullable: true })
  progress_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Study, (study) => study.progress)
  @JoinColumn({ name: 'study_id' })
  study_id: Study;

  @OneToMany(() => Resource, (resource) => resource.progress)
  resources: Resource[];
}
