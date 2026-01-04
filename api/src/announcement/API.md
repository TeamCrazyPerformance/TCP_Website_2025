# Announcement API

공지사항 API입니다.

---

## 목차

- [1. 공개 엔드포인트](#1-공개-엔드포인트)
- [2. Admin 전용 엔드포인트](#2-admin-전용-엔드포인트)

---

## 1. 공개 엔드포인트

### GET /api/v1/announcements

게시일이 지난 모든 공지사항 목록을 조회합니다.

**Request:**
```
GET /api/v1/announcements
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "title": "2026년 1학기 모집 안내",
    "contents": "안녕하세요. TCP 동아리입니다...",
    "summary": "2026년 1학기 신입부원 모집",
    "views": 150,
    "publishAt": "2026-01-01T09:00:00.000Z",
    "createdAt": "2025-12-20T10:00:00.000Z",
    "updatedAt": "2025-12-20T10:00:00.000Z",
    "author": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "admin",
      "name": "관리자",
      "role": "ADMIN"
    }
  }
]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `number` | 공지사항 ID |
| `title` | `string` | 제목 |
| `contents` | `string` | 내용 |
| `summary` | `string` | 요약 |
| `views` | `number` | 조회수 |
| `publishAt` | `string` | 게시일 (ISO 8601) |
| `createdAt` | `string` | 생성일 |
| `updatedAt` | `string` | 수정일 |
| `author` | `object` | 작성자 정보 |

---

### GET /api/v1/announcements/:id

공지사항 상세를 조회합니다. 조회 시 조회수가 1 증가합니다.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 공지사항 ID |

**Request:**
```
GET /api/v1/announcements/1
```

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "2026년 1학기 모집 안내",
  "contents": "안녕하세요. TCP 동아리입니다. 2026년 1학기 신입부원을 모집합니다...",
  "summary": "2026년 1학기 신입부원 모집",
  "views": 151,
  "publishAt": "2026-01-01T09:00:00.000Z",
  "createdAt": "2025-12-20T10:00:00.000Z",
  "updatedAt": "2025-12-20T10:00:00.000Z",
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "admin",
    "name": "관리자",
    "role": "ADMIN"
  }
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 404 | 해당 ID의 공지사항이 없거나 게시일이 아직 되지 않음 |

---

## 2. Admin 전용 엔드포인트

> **인증 필수**: `Authorization: Bearer <access_token>` (ADMIN 권한)

### POST /api/v1/announcements

공지사항을 작성합니다.

**Request:**
```
POST /api/v1/announcements
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "2026년 1학기 모집 안내",
  "contents": "안녕하세요. TCP 동아리입니다. 2026년 1학기 신입부원을 모집합니다...",
  "summary": "2026년 1학기 신입부원 모집",
  "publishAt": "2026-01-01T09:00:00.000Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | `string` | 필수 | 제목 |
| `contents` | `string` | 필수 | 내용 |
| `summary` | `string` | 필수 | 요약 |
| `publishAt` | `string` | 선택 | 게시일 (ISO 8601). 미지정 시 현재 시각 |

**Response (201 Created):**
```json
{
  "id": 1,
  "title": "2026년 1학기 모집 안내",
  "contents": "안녕하세요. TCP 동아리입니다. 2026년 1학기 신입부원을 모집합니다...",
  "summary": "2026년 1학기 신입부원 모집",
  "views": 0,
  "publishAt": "2026-01-01T09:00:00.000Z",
  "createdAt": "2025-12-20T10:00:00.000Z",
  "updatedAt": "2025-12-20T10:00:00.000Z",
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효성 검사 실패 (필수 필드 누락 등) |
| 401 | 인증 토큰 없음/만료 |
| 403 | ADMIN 권한 없음 |

---

### PATCH /api/v1/announcements/:id

공지사항을 수정합니다.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 공지사항 ID |

**Request:**
```
PATCH /api/v1/announcements/1
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "2026년 1학기 모집 안내 (수정)",
  "contents": "수정된 내용입니다...",
  "summary": "수정된 요약",
  "publishAt": "2026-01-02T09:00:00.000Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | `string` | 선택 | 제목 |
| `contents` | `string` | 선택 | 내용 |
| `summary` | `string` | 선택 | 요약 |
| `publishAt` | `string` | 선택 | 게시일 (ISO 8601) |

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "2026년 1학기 모집 안내 (수정)",
  "contents": "수정된 내용입니다...",
  "summary": "수정된 요약",
  "views": 150,
  "publishAt": "2026-01-02T09:00:00.000Z",
  "createdAt": "2025-12-20T10:00:00.000Z",
  "updatedAt": "2026-01-03T15:30:00.000Z"
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효성 검사 실패 |
| 401 | 인증 토큰 없음/만료 |
| 403 | ADMIN 권한 없음 |
| 404 | 해당 ID의 공지사항 없음 |

---

### DELETE /api/v1/announcements/:id

공지사항을 삭제합니다.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 공지사항 ID |

**Request:**
```
DELETE /api/v1/announcements/1
Authorization: Bearer <access_token>
```

**Response:** `204 No Content`

(응답 본문 없음)

**Errors:**

| Status | 설명 |
|--------|------|
| 401 | 인증 토큰 없음/만료 |
| 403 | ADMIN 권한 없음 |
| 404 | 해당 ID의 공지사항 없음 |

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
  "message": "Announcement with ID 999 not found",
  "error": "Not Found"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["title should not be empty", "title must be a string"],
  "error": "Bad Request"
}
```
