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
  start_date: Date | null;

  /** 모집 종료일 */
  @Column({ type: 'timestamp', nullable: true })
  end_date: Date | null;

  /** 지원 버튼 활성화 여부 (수동 토글) */
  @Column({ default: false })
  is_application_enabled: boolean;

  /** 시작일 도달 시 자동 활성화 */
  @Column({ default: false })
  auto_enable_on_start: boolean;

  /** 종료일 경과 시 자동 비활성화 */
  @Column({ default: false })
  auto_disable_on_end: boolean;

  /** 마지막 수정 시간 */
  @UpdateDateColumn()
  updated_at: Date;
}
