import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Award } from './award.entity';
import { ReviewStatus } from './enums/review-status.enum';

@Entity({ name: 'resume' })
export class Resume {
  @PrimaryGeneratedColumn({ comment: 'PK' })
  id: number;

  @Column({ type: 'varchar', length: 200, comment: '이름' })
  name: string;

  @Column({ type: 'varchar', length: 8, comment: '학번' })
  student_number: string;

  @Column({ type: 'varchar', length: 100, comment: '전공(학과)' })
  major: string;

  @Column({ type: 'varchar', length: 20, comment: '전화번호' })
  phone_number: string;

  @Column({ type: 'text', nullable: true, comment: '기술 스택' })
  tech_stack?: string | null;

  @Column({ type: 'text', comment: '관심분야' })
  area_interest: string;

  @Column({ type: 'text', comment: '자기소개' })
  self_introduction: string;

  @Column({ type: 'text', comment: '동아리에 원하는 점(학습 목표)' })
  club_expectation: string;

  @Column({ type: 'smallint', comment: '지원년도' })
  submit_year: number;

  // 심사 관련 필드
  @Column({
    type: 'enum',
    enum: ReviewStatus,
    default: ReviewStatus.PENDING,
    comment: '심사 결정',
  })
  review_status: ReviewStatus;

  @Column({ type: 'text', nullable: true, comment: '검토 의견' })
  review_comment?: string | null;

  @Column({ type: 'timestamp', nullable: true, comment: '검토 시간' })
  reviewed_at?: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    comment: '만들어진 시간',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    comment: '수정된 시간',
  })
  updated_at: Date;

  // Relations
  @OneToMany(() => Project, (project) => project.resume, {
    cascade: ['insert', 'update'],
  })
  projects: Project[];

  @OneToMany(() => Award, (award) => award.resume, {
    cascade: ['insert', 'update'],
  })
  awards: Award[];
}
