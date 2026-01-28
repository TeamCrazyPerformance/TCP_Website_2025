import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../../members/entities/user.entity';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  
  async getMyAccount(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      name: user.name,
      birthDate: user.birth_date,
      phoneNumber: user.phone_number,
      email: user.email,
      studentNumber: user.student_number,
    };
  }

  async updateMyAccount(userId: string, dto: UpdateAccountDto) {
    // 트랜잭션으로 데이터 무결성 보장
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 변경 전 값 로깅용
      const changedFields: string[] = [];

      // 이메일 중복 체크 (실제로 변경될 때만)
      if (dto.email !== undefined && dto.email !== user.email) {
        const existingUser = await queryRunner.manager.findOne(User, {
          where: { email: dto.email },
        });

        if (existingUser) {
          throw new BadRequestException('Email already in use');
        }
      }

      // 학번 중복 체크 (실제로 변경될 때만)
      if (dto.student_number !== undefined && dto.student_number !== user.student_number) {
        const existingUser = await queryRunner.manager.findOne(User, {
          where: { student_number: dto.student_number },
        });

        if (existingUser) {
          throw new BadRequestException('Student number already in use');
        }
      }

      if (dto.name !== undefined && dto.name !== user.name) {
        user.name = dto.name;
        changedFields.push('name');
      }

      if (dto.birth_date !== undefined) {
        const newBirthDate = new Date(dto.birth_date);
        const currentBirthDate = new Date(user.birth_date);
        if (newBirthDate.getTime() !== currentBirthDate.getTime()) {
          user.birth_date = newBirthDate;
          changedFields.push('birth_date');
        }
      }

      if (dto.phone_number !== undefined && dto.phone_number !== user.phone_number) {
        user.phone_number = dto.phone_number;
        changedFields.push('phone_number');
      }

      if (dto.email !== undefined && dto.email !== user.email) {
        user.email = dto.email;
        changedFields.push('email');
      }

      if (dto.student_number !== undefined && dto.student_number !== user.student_number) {
        user.student_number = dto.student_number;
        changedFields.push('student_number');
      }

      await queryRunner.manager.save(user);
      await queryRunner.commitTransaction();

      // 감사 로그
      if (changedFields.length > 0) {
        this.logger.log(
          `User ${userId} updated account info: [${changedFields.join(', ')}]`,
        );
      }

      return {
        message: 'Account information updated successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to update account for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    // 트랜잭션으로 비밀번호 변경 보장
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        select: ['id', 'password', 'username'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 현재 비밀번호 검증
      const isMatch = await bcrypt.compare(
        dto.currentPassword,
        user.password,
      );

      if (!isMatch) {
        this.logger.warn(
          `Failed password change attempt for user ${userId}: incorrect current password`,
        );
        throw new ForbiddenException('Current password is incorrect');
      }

      // 새 비밀번호 확인
      if (dto.newPassword !== dto.confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }

      // 기존 비밀번호와 동일한지 체크
      const isSameAsOld = await bcrypt.compare(
        dto.newPassword,
        user.password,
      );

      if (isSameAsOld) {
        throw new BadRequestException(
          'New password must be different from old password',
        );
      }

      // 비밀번호 암호화 후 저장
      user.password = await bcrypt.hash(dto.newPassword, 10);
      await queryRunner.manager.save(user);
      await queryRunner.commitTransaction();

      this.logger.log(
        `User ${userId} (${user.username}) successfully changed password`,
      );

      return {
        message: 'Password changed successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to change password for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
