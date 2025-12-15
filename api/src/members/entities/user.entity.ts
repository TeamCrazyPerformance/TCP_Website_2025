import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EducationStatus } from './enums/education-status.enum';
import { UserGender } from './enums/user-gender.enum'
import { Announcement } from '../../announcement/entities/announcement.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ select: false, type: 'varchar', length: 255 }) // 조회 시 기본적으로 password 필드는 가져오지 않음
  password: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  student_number: string;

  @Column({ type: 'varchar', length: 255, default: 'default_profile_image.png' }) // TODO 기본 프로필 이미지 추가해야 함
  profile_image: string;

  @Column({ type: 'varchar', length: 20 })
  phone_number: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  major: string;

  @Column({ type: 'smallint' })
  join_year: number;

  @Column({ type: 'date' })
  birth_date: Date;

  @Column({
    type: 'enum',
    enum: UserGender,
    default: UserGender.Male,
  })
  gender: UserGender;

  @Column('text', { array: true, nullable: true })
  tech_stack: string[] | null;

  @Column({ 
    type: 'enum', 
    enum: EducationStatus, 
    default: EducationStatus.Enrolled })
  education_status: EducationStatus;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  current_company: string;

  @Column({ type: 'varchar', nullable: true,  length: 255 })
  baekjoon_username: string;

  @Column({ type: 'varchar', nullable: true,  length: 255 })
  github_username: string;

  @Column({ type: 'text', nullable: true })
  self_description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  portfolio_link: string | null;

  @Column({ default: false })
  is_public_current_company: boolean;

  @Column({ default: false })
  is_public_github_username: boolean;

  @Column({ default: false })
  is_public_baekjoon_username: boolean;

  @Column({ default: false })
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




  @OneToMany(() => Announcement, (announcement) => announcement.author)
  announcements: Announcement[];
}
