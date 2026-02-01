import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { EducationStatus } from './enums/education-status.enum';
import { UserGender } from './enums/user-gender.enum';
import { UserRole } from './enums/user-role.enum';
import { Announcement } from '../../announcement/entities/announcement.entity';
import { StudyMember } from '../../study/entities/study-member.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ select: false, type: 'varchar', length: 255 }) // 조회 시 기본적으로 password 필드는 가져오지 않음
  password: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  student_number: string | null;

  @Column({ type: 'varchar', length: 255, default: 'default_profile_image.png' }) // TODO 기본 프로필 이미지 추가해야 함
  profile_image: string;

  @Column({ type: 'varchar', length: 20 })
  phone_number: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  major: string | null;

  @Column({ type: 'smallint', nullable: true })
  join_year: number | null;

  @Column({ type: 'date', nullable: true })
  birth_date: Date | null;

  @Column({
    type: 'enum',
    enum: UserGender,
    nullable: true,
  })
  gender: UserGender | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.GUEST,
  })
  role: UserRole;

  @Column('text', { array: true, nullable: true })
  tech_stack: string[] | null;

  @Column({
    type: 'enum',
    enum: EducationStatus,
    nullable: true,
  })
  education_status: EducationStatus | null;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  current_company: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  baekjoon_username: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  github_username: string;

  @Column({ type: 'text', nullable: true })
  self_description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  portfolio_link: string | null;

  @Column({ type: 'boolean', default: false })
  is_public_github_username: boolean;

  @Column({ type: 'boolean', default: false })
  is_public_email: boolean;

  @Column({ type: 'boolean', default: false })
  is_public_tech_stack: boolean;

  @Column({ type: 'boolean', default: false })
  is_public_education_status: boolean;

  @Column({ type: 'boolean', default: false })
  is_public_portfolio_link: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @OneToMany(() => Announcement, (announcement) => announcement.author)
  announcements: Announcement[];

  @OneToMany(() => StudyMember, (studyMember) => studyMember.user)
  studyMembers: StudyMember[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];
}
