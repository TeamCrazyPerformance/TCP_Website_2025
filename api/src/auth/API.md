# Auth API

인증 관련 API입니다.

---

## 목차

- [1. 회원가입](#1-회원가입)
- [2. 로그인](#2-로그인)
- [3. 토큰 갱신](#3-토큰-갱신)
- [4. 로그아웃](#4-로그아웃)
- [5. 전체 로그아웃](#5-전체-로그아웃)

---

## 1. 회원가입

### POST /api/v1/auth/register

새로운 회원을 등록합니다.

**Request:**
```
POST /api/v1/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "Password1!",
  "name": "홍길동",
  "student_number": "20210001",
  "profile_image": "/uploads/profiles/default.jpg",
  "phone_number": "010-1234-5678",
  "email": "john@example.com",
  "major": "Computer Science",
  "join_year": 2021,
  "birth_date": "2000-01-15",
  "gender": "Male",
  "tech_stack": ["JavaScript", "TypeScript"],
  "education_status": "Enrolled",
  "current_company": "ABC Corp",
  "baekjoon_username": "john_bj",
  "github_username": "johndoe",
  "self_description": "안녕하세요",
  "is_public_github_username": true,
  "is_public_email": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `username` | `string` | 필수 | 아이디 (3-50자) |
| `password` | `string` | 필수 | 비밀번호 (8-255자, 대소문자+숫자+특수문자 포함) |
| `name` | `string` | 필수 | 이름 (1-50자) |
| `student_number` | `string` | 필수 | 학번 (1-20자) |
| `profile_image` | `string` | 선택 | 프로필 이미지 경로 |
| `phone_number` | `string` | 필수 | 전화번호 (1-20자) |
| `email` | `string` | 필수 | 이메일 |
| `major` | `string` | 필수 | 전공 (최대 100자) |
| `join_year` | `number` | 필수 | 가입 연도 |
| `birth_date` | `string` | 필수 | 생년월일 (YYYY-MM-DD) |
| `gender` | `enum` | 필수 | `Male`, `Female` |
| `tech_stack` | `string[]` | 선택 | 기술 스택 |
| `education_status` | `enum` | 필수 | `Enrolled`, `LeaveOfAbsence`, `Graduated` |
| `current_company` | `string` | 선택 | 현재 회사 |
| `baekjoon_username` | `string` | 선택 | 백준 아이디 |
| `github_username` | `string` | 선택 | GitHub 아이디 |
| `self_description` | `string` | 선택 | 자기소개 |
| `is_public_github_username` | `boolean` | 선택 | GitHub 공개 여부 |
| `is_public_email` | `boolean` | 선택 | 이메일 공개 여부 |

**Response (201 Created):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "name": "홍길동",
    "email": "john@example.com",
    "student_number": "20210001",
    "profile_image": "default_profile_image.png",
    "role": "MEMBER",
    "created_at": "2026-01-04T10:00:00.000Z",
    "updated_at": "2026-01-04T10:00:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> **Note**: `refresh_token`은 HttpOnly 쿠키로 자동 설정됩니다.

**Set-Cookie Header:**
```
refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효성 검사 실패 |
| 409 | 이미 존재하는 username 또는 email |

---

## 2. 로그인

### POST /api/v1/auth/login

로그인하여 토큰을 발급받습니다.

**Request:**
```
POST /api/v1/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "Password1!"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `username` | `string` | 필수 | 아이디 (3-50자) |
| `password` | `string` | 필수 | 비밀번호 (8-255자) |

**Response (201 Created):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "name": "홍길동",
    "email": "john@example.com",
    "student_number": "20210001",
    "profile_image": "profile.jpg",
    "role": "MEMBER",
    "created_at": "2026-01-04T10:00:00.000Z",
    "updated_at": "2026-01-04T10:00:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> **Note**: `refresh_token`은 HttpOnly 쿠키로 자동 설정됩니다.

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효성 검사 실패 |
| 401 | 잘못된 아이디 또는 비밀번호 |

---

## 3. 토큰 갱신

### POST /api/v1/auth/refresh

Refresh Token을 사용하여 새로운 토큰을 발급받습니다.

**Request:**
```
POST /api/v1/auth/refresh
Cookie: refresh_token=<token>
```

> **Note**: Refresh Token은 쿠키에서 자동으로 읽습니다. 별도의 Body 없음.

**Response (201 Created):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "name": "홍길동",
    "email": "john@example.com",
    "student_number": "20210001",
    "profile_image": "profile.jpg",
    "role": "MEMBER",
    "created_at": "2026-01-04T10:00:00.000Z",
    "updated_at": "2026-01-04T10:00:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> **Note**: 새로운 `refresh_token`이 HttpOnly 쿠키로 설정됩니다 (Token Rotation).

**Errors:**

| Status | 설명 |
|--------|------|
| 401 | Refresh token이 없거나 만료됨 |

---

## 4. 로그아웃

### POST /api/v1/auth/logout

현재 디바이스에서 로그아웃합니다.

> **인증 필수**: `Authorization: Bearer <access_token>`

**Request:**
```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
Cookie: refresh_token=<token>
```

**Response (201 Created):**
```json
{
  "message": "로그아웃 되었습니다."
}
```

> **Note**: refresh_token 쿠키가 삭제됩니다.

**Errors:**

| Status | 설명 |
|--------|------|
| 401 | 인증 토큰 없음/만료 |

---

## 5. 전체 로그아웃

### POST /api/v1/auth/logout-all

모든 디바이스에서 로그아웃합니다.

> **인증 필수**: `Authorization: Bearer <access_token>`

**Request:**
```
POST /api/v1/auth/logout-all
Authorization: Bearer <access_token>
```

**Response (201 Created):**
```json
{
  "message": "모든 기기에서 로그아웃 되었습니다."
}
```

> **Note**: 해당 사용자의 모든 refresh_token이 무효화됩니다.

**Errors:**

| Status | 설명 |
|--------|------|
| 401 | 인증 토큰 없음/만료 |

---

## Access Token 사용

발급받은 access_token은 인증이 필요한 API 요청 시 Authorization 헤더에 포함합니다:

```
Authorization: Bearer <access_token>
```

---

## 공통 에러 응답

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["비밀번호는 대문자, 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다."],
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

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Username already exists",
  "error": "Conflict"
}
```
