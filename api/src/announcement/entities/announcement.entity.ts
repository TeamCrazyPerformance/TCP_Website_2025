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

@Entity('announcement')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  contents: string;

  @Column({ type: 'text'})
  summary: string;

  @Column({ type: 'int', default: 0 })   
  views: number;

  @Column({ type: 'timestamp', nullable: true })
  publishAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.announcements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  author: User;
}
