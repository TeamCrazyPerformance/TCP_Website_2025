# Teams API

팀 모집 API입니다. 사용자들이 프로젝트/공모전 등의 팀원을 모집할 수 있습니다.

---

## 목차

- [1. 모집글 관리](#1-모집글-관리)
- [2. 모집 상태 변경](#2-모집-상태-변경)
- [3. 팀 지원](#3-팀-지원)

---

## Enum 값

### TeamStatus
| 값 | 설명 |
|----|------|
| `open` | 모집 중 |
| `closed` | 모집 마감 |

### ExecutionType
| 값 | 설명 |
|----|------|
| `online` | 온라인 |
| `offline` | 오프라인 |
| `hybrid` | 혼합 |

---

## 1. 모집글 관리

### GET /api/v1/teams

모집글 목록을 조회합니다.

**권한**: Public

**Request:**
```
GET /api/v1/teams
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "title": "AI 프로젝트 팀원 모집",
    "category": "프로젝트",
    "periodStart": "2026-02-01T00:00:00.000Z",
    "periodEnd": "2026-05-31T00:00:00.000Z",
    "deadline": "2026-01-20T23:59:59.000Z",
    "description": "AI 기반 서비스를 함께 개발할 팀원을 모집합니다.",
    "techStack": "Python, TensorFlow, FastAPI",
    "tag": "AI",
    "goals": "공모전 수상",
    "executionType": "hybrid",
    "selectionProc": "서류 + 면접",
    "link": "https://example.com/project",
    "contact": "leader@example.com",
    "projectImage": "/uploads/teams/project.jpg",
    "status": "open",
    "createdAt": "2026-01-05T10:00:00.000Z",
    "updatedAt": "2026-01-05T10:00:00.000Z",
    "leader": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "홍길동",
      "profile_image": "profile.jpg"
    },
    "roles": [
      {
        "id": 1,
        "roleName": "백엔드 개발자",
        "recruitCount": 2,
        "currentCount": 0
      },
      {
        "id": 2,
        "roleName": "프론트엔드 개발자",
        "recruitCount": 2,
        "currentCount": 1
      }
    ]
  }
]
```

---

### GET /api/v1/teams/:id

모집글 상세를 조회합니다.

**권한**: Public

**Request:**
```
GET /api/v1/teams/1
```

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "AI 프로젝트 팀원 모집",
  "category": "프로젝트",
  "periodStart": "2026-02-01T00:00:00.000Z",
  "periodEnd": "2026-05-31T00:00:00.000Z",
  "deadline": "2026-01-20T23:59:59.000Z",
  "description": "AI 기반 서비스를 함께 개발할 팀원을 모집합니다.",
  "techStack": "Python, TensorFlow, FastAPI",
  "tag": "AI",
  "goals": "공모전 수상",
  "executionType": "hybrid",
  "selectionProc": "서류 + 면접",
  "link": "https://example.com/project",
  "contact": "leader@example.com",
  "projectImage": "/uploads/teams/project.jpg",
  "status": "open",
  "createdAt": "2026-01-05T10:00:00.000Z",
  "updatedAt": "2026-01-05T10:00:00.000Z",
  "leader": { ... },
  "roles": [ ... ]
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 404 | 해당 ID의 모집글 없음 |

---

### POST /api/v1/teams

모집글을 생성합니다.

**권한**: Member (인증 필요)

**Request:**
```
POST /api/v1/teams
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "AI 프로젝트 팀원 모집",
  "category": "프로젝트",
  "periodStart": "2026-02-01",
  "periodEnd": "2026-05-31",
  "deadline": "2026-01-20T23:59:59.000Z",
  "description": "AI 기반 서비스를 함께 개발할 팀원을 모집합니다.",
  "techStack": "Python, TensorFlow, FastAPI",
  "tag": "AI",
  "goals": "공모전 수상",
  "executionType": "hybrid",
  "selectionProc": "서류 + 면접",
  "link": "https://example.com/project",
  "contact": "leader@example.com",
  "projectImage": "/uploads/teams/project.jpg",
  "roles": [
    {
      "roleName": "백엔드 개발자",
      "recruitCount": 2
    },
    {
      "roleName": "프론트엔드 개발자",
      "recruitCount": 2
    }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | `string` | 필수 | 제목 |
| `category` | `string` | 필수 | 카테고리 |
| `periodStart` | `string` | 필수 | 프로젝트 시작일 (ISO 8601) |
| `periodEnd` | `string` | 필수 | 프로젝트 종료일 (ISO 8601) |
| `deadline` | `string` | 필수 | 모집 마감일 (ISO 8601) |
| `description` | `string` | 필수 | 설명 |
| `techStack` | `string` | 선택 | 기술 스택 |
| `tag` | `string` | 선택 | 태그 |
| `goals` | `string` | 선택 | 목표 |
| `executionType` | `enum` | 선택 | `online`, `offline`, `hybrid` |
| `selectionProc` | `string` | 선택 | 선발 과정 |
| `link` | `string` | 선택 | 관련 링크 (URL) |
| `contact` | `string` | 필수 | 연락처 |
| `projectImage` | `string` | 선택 | 프로젝트 이미지 경로 |
| `roles` | `array` | 필수 | 모집 역할 (최소 1개) |

**roles 객체:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `roleName` | `string` | 필수 | 역할명 |
| `recruitCount` | `number` | 필수 | 모집 인원 (1 이상) |

**Response (201 Created):**
```json
{
  "id": 1,
  "title": "AI 프로젝트 팀원 모집",
  "status": "open",
  "leader": { ... },
  "roles": [ ... ],
  "members": [ ... ]
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 역할이 없거나 역할명 중복 |
| 401 | 인증 토큰 없음/만료 |

---

### PATCH /api/v1/teams/:id

모집글을 수정합니다.

**권한**: 팀장만 (본인 확인)

**Request:**
```
PATCH /api/v1/teams/1
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "AI 프로젝트 팀원 모집 (수정)",
  "deadline": "2026-01-25T23:59:59.000Z",
  "rolesToUpdate": [
    {
      "id": 1,
      "roleName": "백엔드 개발자 (수정)",
      "recruitCount": 3,
      "action": "update"
    },
    {
      "id": 2,
      "action": "delete"
    }
  ],
  "rolesToAdd": [
    {
      "roleName": "AI 엔지니어",
      "recruitCount": 1
    }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | `string` | 선택 | 제목 |
| `category` | `string` | 선택 | 카테고리 |
| `periodStart` | `string` | 선택 | 프로젝트 시작일 |
| `periodEnd` | `string` | 선택 | 프로젝트 종료일 |
| `deadline` | `string` | 선택 | 모집 마감일 |
| `description` | `string` | 선택 | 설명 |
| `techStack` | `string` | 선택 | 기술 스택 |
| `tag` | `string` | 선택 | 태그 |
| `goals` | `string` | 선택 | 목표 |
| `executionType` | `enum` | 선택 | 실행 방식 |
| `selectionProc` | `string` | 선택 | 선발 과정 |
| `link` | `string` | 선택 | 관련 링크 |
| `contact` | `string` | 선택 | 연락처 |
| `projectImage` | `string` | 선택 | 프로젝트 이미지 |
| `rolesToUpdate` | `array` | 선택 | 수정/삭제할 역할 |
| `rolesToAdd` | `array` | 선택 | 추가할 역할 |

**rolesToUpdate 객체:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `number` | 필수 | 역할 ID |
| `roleName` | `string` | 선택 | 변경할 역할명 |
| `recruitCount` | `number` | 선택 | 변경할 모집 인원 |
| `action` | `string` | 선택 | `update` 또는 `delete` |

**rolesToAdd 객체:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `roleName` | `string` | 필수 | 역할명 |
| `recruitCount` | `number` | 필수 | 모집 인원 |

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "AI 프로젝트 팀원 모집 (수정)",
  "leader": { ... },
  "roles": [ ... ]
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 역할 ID가 해당 팀에 없음 |
| 403 | 팀장이 아님 |
| 404 | 모집글 없음 |
| 409 | 역할명 중복 |

---

### DELETE /api/v1/teams/:id

모집글을 삭제합니다.

**권한**: 팀장만 (본인 확인)

**Request:**
```
DELETE /api/v1/teams/1
Authorization: Bearer <access_token>
```

**Response:** `204 No Content`

**Errors:**

| Status | 설명 |
|--------|------|
| 403 | 팀장이 아님 |
| 404 | 모집글 없음 |

---

## 2. 모집 상태 변경

### PATCH /api/v1/teams/:id/status

모집 상태를 변경합니다.

**권한**: 팀장만 (본인 확인)

**Request:**
```
PATCH /api/v1/teams/1/status
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "closed"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `status` | `enum` | 필수 | `open`, `closed` |

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "AI 프로젝트 팀원 모집",
  "status": "closed",
  ...
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효하지 않은 status 값 |
| 403 | 팀장이 아님 |
| 404 | 모집글 없음 |

---

## 3. 팀 지원

### POST /api/v1/teams/:id/apply

팀에 지원합니다.

**권한**: Member (인증 필요)

**Request:**
```
POST /api/v1/teams/1/apply
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "roleId": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `roleId` | `number` | 필수 | 지원할 역할 ID |

**Response (201 Created):**
```json
{
  "id": 5,
  "isLeader": false,
  "user": { ... },
  "team": { ... },
  "role": { ... }
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 이미 해당 팀에 지원함 |
| 404 | 팀 또는 역할 없음 |

---

### DELETE /api/v1/teams/:id/apply

팀 지원을 취소합니다.

**권한**: 지원자 본인 (인증 필요)

**Request:**
```
DELETE /api/v1/teams/1/apply
Authorization: Bearer <access_token>
```

**Response (200 OK):**
(응답 본문 없음 또는 void)

**Errors:**

| Status | 설명 |
|--------|------|
| 403 | 팀장은 지원 취소 불가 |
| 404 | 지원 내역 없음 |

---

### GET /api/v1/teams/:id/application-status

현재 사용자의 팀 지원 상태를 조회합니다.

**권한**: Member (인증 필요)

**Request:**
```
GET /api/v1/teams/1/application-status
Authorization: Bearer <access_token>
```

**Response (200 OK):**

**지원하지 않은 경우:**
```json
{
  "hasApplied": false,
  "applicationInfo": null
}
```

**지원한 경우:**
```json
{
  "hasApplied": true,
  "applicationInfo": {
    "appliedRole": {
      "id": 1,
      "roleName": "백엔드 개발자"
    }
  }
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 404 | 팀이 존재하지 않음 |

**참고:** 팀장인 경우에도 `hasApplied: false`를 반환합니다.

---

## 공통 에러 응답

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "At least one role is required",
  "error": "Bad Request"
}
```

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
  "message": "Only the team leader can update this team",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Team with id 999 not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Role name 'Backend' already exists.",
  "error": "Conflict"
}
```
