# Admin API Documentation

관리자(ADMIN) 전용 API 엔드포인트입니다.

> **인증 필수**: 모든 Admin API는 `Authorization: Bearer <access_token>` 헤더가 필요하며, 해당 사용자의 `role`이 `ADMIN`이어야 합니다.

---

## 목차

- [1. Activity Images (활동 사진)](#1-activity-images-활동-사진)
- [2. Members (회원 관리)](#2-members-회원-관리)
- [3. System (시스템 관리)](#3-system-시스템-관리)

---

## 1. Activity Images (활동 사진)

### GET /api/v1/admin/activity-images

활동 사진 목록을 조회합니다.

**Request:**
```
GET /api/v1/admin/activity-images
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "competition": "/activities/competition.jpg",
  "study": "/activities/study.jpg",
  "mt": null
}
```

---

### POST /api/v1/admin/activity-images

활동 사진을 업로드하거나 삭제합니다.

**Request:**
```
POST /api/v1/admin/activity-images
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `competition` | `file` | 공모전 활동 사진 |
| `study` | `file` | 스터디 활동 사진 |
| `mt` | `file` | MT 활동 사진 |
| `removeCompetition` | `string` | `"true"` 전송 시 삭제 |
| `removeStudy` | `string` | `"true"` 전송 시 삭제 |
| `removeMt` | `string` | `"true"` 전송 시 삭제 |

**Response (201 Created):**
```json
{
  "message": "활동 사진 저장 완료"
}
```

---

### DELETE /api/v1/admin/activity-images/:type

특정 타입의 활동 사진을 삭제합니다.

**Path Parameters:**
| 파라미터 | 설명 |
|----------|------|
| `type` | `competition`, `study`, `mt` 중 하나 |

**Response (200 OK):**
```json
{
  "message": "competition 사진 삭제 완료"
}
```

---

## 2. Members (회원 관리)

### GET /api/v1/admin/members

모든 회원 목록을 조회합니다.

**Request:**
```
GET /api/v1/admin/members
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "name": "홍길동",
    "student_number": "20210001",
    "profile_image": "/uploads/profiles/image.jpg",
    "phone_number": "010-1234-5678",
    "email": "john@example.com",
    "major": "Computer Science",
    "join_year": 2021,
    "birth_date": "2000-01-15",
    "gender": "Male",
    "tech_stack": ["JavaScript", "TypeScript"],
    "education_status": "Enrolled",
    "role": "MEMBER",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-06-01T12:00:00.000Z",
    "deleted_at": null
  }
]
```

---

### PATCH /api/v1/admin/members/:id

특정 회원 정보를 수정합니다.

**Path Parameters:**
| 파라미터 | 설명 |
|----------|------|
| `id` | 회원 UUID |

**Request Body:**
```json
{
  "name": "김철수",
  "student_number": "20210002",
  "phone_number": "010-9999-8888",
  "email": "kim@example.com",
  "major": "Software Engineering",
  "join_year": 2022,
  "birth_date": "1999-05-20",
  "gender": "Male",
  "education_status": "Graduated"
}
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "김철수",
  "major": "Software Engineering",
  "education_status": "Graduated"
}
```

---

### DELETE /api/v1/admin/members/:id

특정 회원을 삭제합니다 (Soft Delete).

**Path Parameters:**
| 파라미터 | 설명 |
|----------|------|
| `id` | 회원 UUID |

**Response:** `204 No Content`

---

## 3. System (시스템 관리)

### GET /api/v1/admin/system/stats

서버 시스템 상태를 조회합니다.

**Request:**
```
GET /api/v1/admin/system/stats
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "cpu": {
    "manufacturer": "Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz",
    "cores": 8,
    "usagePercentage": 15.23
  },
  "memory": {
    "total": 17179869184,
    "active": 8589934592,
    "used": 10737418240,
    "free": 6442450944,
    "usagePercentage": 50.0
  },
  "disk": {
    "total": 500107862016,
    "used": 250053931008,
    "usagePercentage": 50.0
  },
  "os": {
    "platform": "linux",
    "distro": "Alpine Linux",
    "release": "3.18",
    "hostname": "api-server"
  },
  "uptime": 86400
}
```

---

### POST /api/v1/admin/system/restart

서버를 재시작합니다.

**Response (201 Created):**
```json
{
  "message": "Server is restarting..."
}
```

---

### POST /api/v1/admin/system/shutdown

서버를 종료합니다.

**Response (201 Created):**
```json
{
  "message": "Server is shutting down..."
}
```

---

## 공통 에러 응답

| Status | 응답 |
|--------|------|
| 401 | `{"statusCode": 401, "message": "Unauthorized"}` |
| 403 | `{"statusCode": 403, "message": "Forbidden resource"}` |
| 404 | `{"statusCode": 404, "message": "Not found"}` |
