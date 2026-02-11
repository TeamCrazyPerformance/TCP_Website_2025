import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { User } from '../members/entities/user.entity';

@Injectable()
export class MemberCleanupJob {
  private readonly logger = new Logger(MemberCleanupJob.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // 매일 새벽 3시
  @Cron('0 3 * * *')
  async hardDeleteExpiredMembers() {
    const startTime = Date.now();
    this.logger.log('만료된 회원 영구 삭제 작업 시작');

    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const expiredUsers = await this.userRepository.find({
        where: {
          deleted_at: LessThan(twoDaysAgo),
        },
        withDeleted: true,
      });

      if (expiredUsers.length === 0) {
        this.logger.log('삭제할 만료 회원이 없습니다');
        return;
      }

      this.logger.log(`${expiredUsers.length}명의 만료 회원을 영구 삭제합니다`);

      // 트랜잭션으로 안전하게 삭제
      await this.dataSource.transaction(async (manager) => {
        await manager.remove(expiredUsers);
      });

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `만료 회원 ${expiredUsers.length}명 영구 삭제 완료 (소요시간: ${elapsed}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `만료 회원 영구 삭제 중 오류 발생: ${error.message}`,
        error.stack,
      );
      // 에러를 다시 던지지 않아 크론 작업이 계속 실행되도록 함
    }
  }
}
