# MyPage Study API

마이페이지 스터디 관리 API입니다.

---

## 목차

- [1. 인증 필요 엔드포인트](#1-인증-필요-엔드포인트)
  - [1.1 내 스터디 목록 조회](#11-내-스터디-목록-조회)
  - [1.2 스터디 상세 조회](#12-스터디-상세-조회)

---

## 1. 인증 필요 엔드포인트

> **인증 필수**: `Authorization: Bearer <access_token>`

---

### 1.1 내 스터디 목록 조회

현재 로그인한 사용자가 참여 중인 스터디 목록을 진행중/완료로 구분하여 조회합니다.

**Request:**
```
GET /api/v1/mypage/study
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "ongoingStudies": [
    {
      "id": 1,
      "study_name": "알고리즘 스터디",
      "period": "2026-01-01 ~ 2026-06-30",
      "memberCount": 5,
      "way": "오프라인",
      "tag": "알고리즘"
    }
  ],
  "completedStudies": [
    {
      "id": 2,
      "study_name": "웹 개발 스터디",
      "period": "2025-09-01 ~ 2025-12-31",
      "memberCount": 4,
      "way": "온라인",
      "tag": "React"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `ongoingStudies` | `array` | 진행중인 스터디 목록 |
| `completedStudies` | `array` | 완료된 스터디 목록 |

**스터디 항목 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `number` | 스터디 ID |
| `study_name` | `string` | 스터디 이름 |
| `period` | `string` | 기간 (YYYY-MM-DD ~ YYYY-MM-DD) |
| `memberCount` | `number` | 참여자 수 |
| `way` | `string` | 진행 방식 (온라인/오프라인) |
| `tag` | `string` | 태그 |

> **Note**: 
> - 종료일이 지난 스터디는 `completedStudies`에 포함됩니다.

**Errors:**

| Status | 설명 |
|--------|------|
| 401 | 인증 토큰 없음/만료 |

---

### 1.2 스터디 상세 조회

특정 스터디의 상세 정보를 조회합니다.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 스터디 ID |

**Request:**
```
GET /api/v1/mypage/study/:id
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "study_name": "알고리즘 스터디",
  "study_description": "백준 문제 풀이 스터디입니다. 매주 목표를 정하고 함께 문제를 풀어나갑니다.",
  "tag": "알고리즘",
  "period": "2026-01-01 ~ 2026-06-30",
  "place": "학교 스터디룸",
  "way": "오프라인",
  "memberCount": 5,
  "progress": 15
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `number` | 스터디 ID |
| `study_name` | `string` | 스터디 이름 |
| `study_description` | `string` | 스터디 설명 |
| `tag` | `string` | 태그 |
| `period` | `string` | 기간 (YYYY-MM-DD ~ YYYY-MM-DD) |
| `place` | `string` | 장소 |
| `way` | `string` | 진행 방식 |
| `memberCount` | `number` | 현재 참여자 수 |
| `progress` | `number` | 진행률 (0~100) |

**Errors:**

| Status | 설명 |
|--------|------|
| 401 | 인증 토큰 없음/만료 |
| 403 | 해당 스터디의 멤버가 아님 |
| 404 | 스터디를 찾을 수 없음 |

**에러 예시:**

```json
{
  "statusCode": 403,
  "message": "Access denied: You are not a member of this study",
  "error": "Forbidden"
}
```

```json
{
  "statusCode": 404,
  "message": "Study with id 999 not found",
  "error": "Not Found"
}
```

---

## 공통 에러 응답

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Access denied: You are not a member of this study",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Study with id {id} not found",
  "error": "Not Found"
}
```

---

## 사용 예시

### 내 스터디 목록 조회
```bash
curl -X GET http://localhost:3000/api/v1/mypage/study \
  -H "Authorization: Bearer {access_token}"
```

### 스터디 상세 조회
```bash
curl -X GET http://localhost:3000/api/v1/mypage/study/1 \
  -H "Authorization: Bearer {access_token}"
```

---

## 참고사항

### 진행률 계산
- 진행률은 전체 기간 대비 경과 일수로 자동 계산됩니다.
- 공식: `(경과 일수 / 전체 일수) × 100`
- 최소값: 0%, 최대값: 100%
- 시작 전인 경우 0%, 종료 후에는 100%로 표시됩니다.


### 권한
- 해당 스터디의 멤버만 상세 정보를 조회할 수 있습니다.
- PENDING 상태의 지원자는 포함되지 않습니다.
