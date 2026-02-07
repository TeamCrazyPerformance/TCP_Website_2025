# Members API

회원 정보 API입니다.

---

## 목차

- [1. 공개 엔드포인트](#1-공개-엔드포인트)
- [2. 인증 필요 엔드포인트](#2-인증-필요-엔드포인트)

---

## 1. 공개 엔드포인트

### GET /api/v1/members

모든 회원의 공개 정보 목록을 조회합니다.

> **Note**: 각 회원의 공개 설정에 따라 반환되는 필드가 다릅니다.

**Request:**
```
GET /api/v1/members
```

**Response (200 OK):**
```json
[
  {
    "name": "홍길동",
    "profile_image": "550e8400-e29b-41d4-a716-446655440000.jpg",
    "self_description": "안녕하세요, 백엔드 개발자입니다.",
    "email": "hong@example.com",
    "tech_stack": ["JavaScript", "TypeScript", "NestJS"],
    "education_status": "Enrolled",
    "github_username": "honggildong",
    "portfolio_link": "https://portfolio.example.com"
  },
  {
    "name": "김철수",
    "profile_image": "default_profile_image.png",
    "self_description": null
  }
]
```

| 필드 | 타입 | 조건 | 설명 |
|------|------|------|------|
| `name` | `string` | 항상 | 이름 |
| `profile_image` | `string` | 항상 | 프로필 이미지 파일명 |
| `self_description` | `string \| null` | 항상 | 자기소개 |
| `email` | `string` | `is_public_email = true` | 이메일 |
| `tech_stack` | `string[]` | `is_public_tech_stack = true` | 기술 스택 |
| `github_username` | `string` | `is_public_github_username = true` | GitHub 아이디 |
| `portfolio_link` | `string` | `is_public_portfolio_link = true` | 포트폴리오 링크 |

---

## 2. 인증 필요 엔드포인트

### PATCH /api/v1/members/me/profile-image

현재 로그인한 사용자의 프로필 이미지를 업로드/변경합니다.

> **인증 필수**: `Authorization: Bearer <access_token>`

**Request:**
```
PATCH /api/v1/members/me/profile-image
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | `file` | 필수 | 이미지 파일 (jpg, jpeg, png, gif, webp) |

**제한사항:**
- 최대 파일 크기: 5MB
- 허용 형식: jpg, jpeg, png, gif, webp

**Response (200 OK):**
```json
{
  "profile_image": "/uploads/profiles/550e8400-e29b-41d4-a716-446655440000.jpg"
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 파일이 없거나 형식/크기 제한 초과 |
| 401 | 인증 토큰 없음/만료 |
| 404 | 사용자를 찾을 수 없음 |

---

## 공통 에러 응답

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed (expected type is /(jpg|jpeg|png|gif|webp)$/)",
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

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "사용자를 찾을 수 없습니다.",
  "error": "Not Found"
}
```

---

## 프로필 이미지 접근

업로드된 프로필 이미지는 정적 파일로 제공됩니다:

```
GET /uploads/profiles/{filename}
```

예시:
```
GET /uploads/profiles/550e8400-e29b-41d4-a716-446655440000.jpg
```
