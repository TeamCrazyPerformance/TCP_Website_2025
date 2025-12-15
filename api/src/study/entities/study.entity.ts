import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from './role.entity';
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Role, (role) => role.study_id)
  roles: Role[];

  @OneToMany(() => Progress, (progress) => progress.study_id)
  progress: Progress[];

  @OneToMany(() => Resource, (resource) => resource.study_id)
  resources: Resource[];
}
