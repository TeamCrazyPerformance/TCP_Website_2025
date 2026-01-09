# Jobs (Scheduled Tasks)

백그라운드에서 실행되는 스케줄 작업입니다.

> **Note**: 이 모듈은 REST API 엔드포인트를 제공하지 않습니다. NestJS Schedule 모듈을 사용한 Cron 작업입니다.

---

## 목차

- [1. MemberCleanupJob](#1-membercleanupjob)
- [2. RecruitmentSettingsJob](#2-recruitmentsettingsjob)

---

## 1. MemberCleanupJob

### 설명

Soft Delete된 회원을 일정 기간 후 영구 삭제하는 작업입니다.

### 실행 주기

```
0 3 * * *  (매일 새벽 3시)
```

### 동작

1. `deleted_at`이 30일 이상 지난 회원 조회
2. 트랜잭션으로 안전하게 영구 삭제 (Hard Delete)
3. 삭제 결과 로깅

### 로그 예시

```
[MemberCleanupJob] 만료된 회원 영구 삭제 작업 시작
[MemberCleanupJob] 5명의 만료 회원을 영구 삭제합니다
[MemberCleanupJob] 만료 회원 5명 영구 삭제 완료 (소요시간: 150ms)
```

### 에러 처리

- 에러 발생 시 로그에 기록하고 작업 종료 (다음 스케줄에 다시 시도)
- 에러가 발생해도 크론 작업은 계속 유지됨

---

## 2. RecruitmentSettingsJob

### 설명

모집 설정의 자동 활성화/비활성화를 체크하는 작업입니다.

### 실행 주기

```
* * * * *  (매 분마다)
```

### 동작

1. `recruitment_settings` 테이블에서 현재 설정 조회
2. 조건에 따라 `is_application_enabled` 자동 변경:
   - **자동 활성화**: `auto_enable_on_start = true` 이고 `start_date`가 현재 시각 이전이면 활성화
   - **자동 비활성화**: `auto_disable_on_end = true` 이고 `end_date`가 현재 시각 이전이면 비활성화
3. 변경 사항이 있으면 DB에 저장 및 로깅

### 로그 예시

```
[RecruitmentSettingsJob] Application automatically enabled (start date reached)
[RecruitmentSettingsJob] Application automatically disabled (end date passed)
```

### 에러 처리

- 에러 발생 시 로그에 기록
- 에러가 발생해도 다음 분에 다시 시도

---

## 환경 설정

Jobs 모듈은 `@nestjs/schedule`을 사용합니다. `app.module.ts`에서 `ScheduleModule.forRoot()`가 import되어 있어야 합니다.

```typescript
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ...
  ],
})
export class AppModule {}
```
