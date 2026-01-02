import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('recruitment_settings')
export class RecruitmentSettings {
  @PrimaryGeneratedColumn()
  id: number;

  /** 모집 시작일 */
  @Column({ type: 'timestamp', nullable: true })
  startDate: Date | null;

  /** 모집 종료일 */
  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  /** 지원 버튼 활성화 여부 (수동 토글) */
  @Column({ default: false })
  isApplicationEnabled: boolean;

  /** 시작일 도달 시 자동 활성화 */
  @Column({ default: false })
  autoEnableOnStart: boolean;

  /** 종료일 경과 시 자동 비활성화 */
  @Column({ default: false })
  autoDisableOnEnd: boolean;

  /** 마지막 수정 시간 */
  @UpdateDateColumn()
  updatedAt: Date;
}
