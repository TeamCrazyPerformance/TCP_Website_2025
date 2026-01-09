# Recruitment API

모집 및 지원서 관리 API입니다.

---

## 목차

- [1. 공개 엔드포인트](#1-공개-엔드포인트)
- [2. Admin 전용 - 모집 설정](#2-admin-전용---모집-설정)
- [3. Admin 전용 - 지원서 관리](#3-admin-전용---지원서-관리)

---

## 1. 공개 엔드포인트

### GET /api/v1/recruitment/status

현재 모집 상태를 조회합니다 (프론트엔드용).

**Request:**
```
GET /api/v1/recruitment/status
```

**Response (200 OK):**
```json
{
  "is_application_enabled": true,
  "start_date": "2026-01-01T00:00:00.000Z",
  "end_date": "2026-01-31T23:59:59.000Z"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `is_application_enabled` | `boolean` | 현재 지원 가능 여부 |
| `start_date` | `string \| null` | 모집 시작일 |
| `end_date` | `string \| null` | 모집 종료일 |

---

### POST /api/v1/recruitment

지원서를 제출합니다.

**Request:**
```
POST /api/v1/recruitment
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "홍길동",
  "student_number": "20210001",
  "major": "컴퓨터공학과",
  "phone_number": "010-1234-5678",
  "tech_stack": "JavaScript, Python, React",
  "area_interest": "웹 개발",
  "self_introduction": "안녕하세요, 저는...",
  "club_expectation": "많은 것을 배우고 싶습니다.",
  "submit_year": 2026,
  "awards": [
    {
      "award_name": "해커톤 대상",
      "award_institution": "OO대학교",
      "award_date": "2025-11-15",
      "award_description": "팀 프로젝트로 대상 수상"
    }
  ],
  "projects": [
    {
      "project_name": "포트폴리오 웹사이트",
      "project_contribution": "프론트엔드 전체 개발",
      "project_date": "2025-06-01",
      "project_description": "React로 만든 개인 포트폴리오",
      "project_tech_stack": "React, TypeScript, Tailwind"
    }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | `string` | 필수 | 이름 |
| `student_number` | `string` | 필수 | 학번 (8자리) |
| `major` | `string` | 필수 | 전공 |
| `phone_number` | `string` | 필수 | 전화번호 |
| `tech_stack` | `string` | 선택 | 기술 스택 |
| `area_interest` | `string` | 필수 | 관심 분야 |
| `self_introduction` | `string` | 필수 | 자기소개 |
| `club_expectation` | `string` | 필수 | 동아리 기대 |
| `submit_year` | `number` | 필수 | 지원 연도 |
| `awards` | `array` | 선택 | 수상 경력 |
| `projects` | `array` | 선택 | 프로젝트 경험 |

**awards 객체:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `award_name` | `string` | 필수 | 수상명 |
| `award_institution` | `string` | 필수 | 수여 기관 |
| `award_date` | `string` | 필수 | 수상일 (YYYY-MM-DD) |
| `award_description` | `string` | 필수 | 상세 설명 |

**projects 객체:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `project_name` | `string` | 필수 | 프로젝트명 |
| `project_contribution` | `string` | 필수 | 기여 내용 |
| `project_date` | `string` | 필수 | 수행일 (YYYY-MM-DD) |
| `project_description` | `string` | 필수 | 프로젝트 설명 |
| `project_tech_stack` | `string` | 필수 | 사용 기술 |

**Response (201 Created):**
```json
{
  "success": true,
  "id": 1
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효성 검사 실패 |

---

## 2. Admin 전용 - 모집 설정

> **인증 필수**: `Authorization: Bearer <access_token>` (ADMIN 권한)

### GET /api/v1/admin/recruitment/settings

현재 모집 설정을 조회합니다.

**Request:**
```
GET /api/v1/admin/recruitment/settings
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "start_date": "2026-01-01T00:00:00.000Z",
  "end_date": "2026-01-31T23:59:59.000Z",
  "is_application_enabled": true,
  "auto_enable_on_start": true,
  "auto_disable_on_end": true,
  "updated_at": "2026-01-02T12:00:00.000Z"
}
```

---

### PATCH /api/v1/admin/recruitment/settings

모집 설정을 변경합니다.

**Request:**
```
PATCH /api/v1/admin/recruitment/settings
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "start_date": "2026-01-15T09:00:00.000Z",
  "end_date": "2026-01-31T18:00:00.000Z",
  "is_application_enabled": false,
  "auto_enable_on_start": true,
  "auto_disable_on_end": true
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `start_date` | `string \| null` | 선택 | 모집 시작일 (ISO 8601) |
| `end_date` | `string \| null` | 선택 | 모집 종료일 (ISO 8601) |
| `is_application_enabled` | `boolean` | 선택 | 지원 활성화 여부 |
| `auto_enable_on_start` | `boolean` | 선택 | 시작일 자동 활성화 |
| `auto_disable_on_end` | `boolean` | 선택 | 종료일 자동 비활성화 |

**Response (200 OK):**
```json
{
  "id": 1,
  "start_date": "2026-01-15T09:00:00.000Z",
  "end_date": "2026-01-31T18:00:00.000Z",
  "is_application_enabled": false,
  "auto_enable_on_start": true,
  "auto_disable_on_end": true,
  "updated_at": "2026-01-03T22:45:00.000Z"
}
```

---

### POST /api/v1/admin/recruitment/start-now

즉시 모집을 시작합니다.

**Request:**
```
POST /api/v1/admin/recruitment/start-now
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "모집이 시작되었습니다."
}
```

---

### POST /api/v1/admin/recruitment/stop-now

즉시 모집을 중단합니다.

**Request:**
```
POST /api/v1/admin/recruitment/stop-now
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "모집이 중단되었습니다."
}
```

---

## 3. Admin 전용 - 지원서 관리

> **인증 필수**: `Authorization: Bearer <access_token>` (ADMIN 권한)

### GET /api/v1/recruitment

모든 지원서 목록을 조회합니다.

**Request:**
```
GET /api/v1/recruitment
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "홍길동",
    "student_number": "20210001",
    "major": "컴퓨터공학과",
    "phone_number": "010-1234-5678",
    "tech_stack": "JavaScript, Python",
    "area_interest": "웹 개발",
    "self_introduction": "안녕하세요...",
    "club_expectation": "많은 것을 배우고 싶습니다.",
    "submit_year": 2026,
    "created_at": "2026-01-01T10:00:00.000Z",
    "awards": [...],
    "projects": [...]
  }
]
```

---

### GET /api/v1/recruitment/:id

특정 지원서를 조회합니다.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 지원서 ID |

**Request:**
```
GET /api/v1/recruitment/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "홍길동",
  "student_number": "20210001",
  "major": "컴퓨터공학과",
  "phone_number": "010-1234-5678",
  "tech_stack": "JavaScript, Python",
  "area_interest": "웹 개발",
  "self_introduction": "안녕하세요...",
  "club_expectation": "많은 것을 배우고 싶습니다.",
  "submit_year": 2026,
  "created_at": "2026-01-01T10:00:00.000Z",
  "awards": [],
  "projects": []
}
```

---

### PATCH /api/v1/recruitment/:id

특정 지원서를 수정합니다.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 지원서 ID |

**Request:**
```
PATCH /api/v1/recruitment/1
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "김철수",
  "major": "소프트웨어학과"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### DELETE /api/v1/recruitment/:id

특정 지원서를 삭제합니다.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 지원서 ID |

**Request:**
```
DELETE /api/v1/recruitment/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true
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
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Recruitment with ID \"999\" not found",
  "error": "Not Found"
}
```
