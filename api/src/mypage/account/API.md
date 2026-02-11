# Account API

마이페이지 계정 정보 관리 API입니다.

---

## 목차

- [1. 인증 필요 엔드포인트](#1-인증-필요-엔드포인트)
  - [1.1 개인정보 조회](#11-개인정보-조회)
  - [1.2 개인정보 수정](#12-개인정보-수정)
  - [1.3 비밀번호 변경](#13-비밀번호-변경)

---

## 1. 인증 필요 엔드포인트

> **인증 필수**: `Authorization: Bearer <access_token>`

---

### 1.1 개인정보 조회

현재 로그인한 사용자의 개인정보를 조회합니다.

**Request:**
```
GET /api/v1/mypage/account
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "name": "홍길동",
  "birthDate": "1990-01-01T00:00:00.000Z",
  "phoneNumber": "010-1234-5678",
  "email": "hong@example.com"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | `string` | 이름 |
| `birthDate` | `string` | 생일 (ISO 8601) |
| `phoneNumber` | `string` | 연락처 |
| `email` | `string` | 이메일 |

**Errors:**

| Status | 설명 |
|--------|------|
| 401 | 인증 토큰 없음/만료 |
| 404 | 사용자를 찾을 수 없음 |

---

### 1.2 개인정보 수정

이름, 생일, 연락처, 이메일을 수정합니다.

**Request:**
```
PATCH /api/v1/mypage/account
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "김철수",
  "birth_date": "1995-05-05",
  "phone_number": "010-9999-8888",
  "email": "kim@example.com"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | `string` | 선택 | 이름 |
| `birth_date` | `string` | 선택 | 생일 (YYYY-MM-DD) |
| `phone_number` | `string` | 선택 | 연락처 (010-1234-5678) |
| `email` | `string` | 선택 | 이메일 |

> **Note**: 
> - 모든 필드는 선택사항입니다. 변경하고자 하는 필드만 전송하면 됩니다.
> - 연락처는 반드시 `010-1234-5678` 형식이어야 합니다.
> - 이메일 중복 시 에러가 발생합니다.

**Response (200 OK):**
```json
{
  "message": "Account information updated successfully"
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효성 검사 실패 (형식 오류, 이메일 중복 등) |
| 401 | 인증 토큰 없음/만료 |
| 404 | 사용자를 찾을 수 없음 |

**에러 예시:**

```json
{
  "statusCode": 400,
  "message": "Invalid phone number format (required: 010-1234-5678)",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "Email already in use",
  "error": "Bad Request"
}
```

---

### 1.3 비밀번호 변경

현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다.

**Request:**
```
PATCH /api/v1/mypage/account/password
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!A",
  "confirmPassword": "NewPassword456!A"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `currentPassword` | `string` | 필수 | 현재 비밀번호 |
| `newPassword` | `string` | 필수 | 새 비밀번호 |
| `confirmPassword` | `string` | 필수 | 새 비밀번호 확인 |

**비밀번호 규칙:**
- 길이: 8~255자
- 대문자, 소문자, 숫자, 특수문자(@$!%*?&) 각각 1개 이상 포함
- 현재 비밀번호와 새 비밀번호는 달라야 함
- 새 비밀번호와 확인 비밀번호는 일치해야 함

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**

| Status | 설명 |
|--------|------|
| 400 | 유효성 검사 실패 (비밀번호 불일치, 형식 오류 등) |
| 401 | 인증 토큰 없음/만료 |
| 403 | 현재 비밀번호가 올바르지 않음 |
| 404 | 사용자를 찾을 수 없음 |

**에러 예시:**

```json
{
  "statusCode": 403,
  "message": "Current password is incorrect",
  "error": "Forbidden"
}
```

```json
{
  "statusCode": 400,
  "message": "Passwords do not match",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "New password must be different from old password",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": [
    "비밀번호는 대문자, 소문자, 숫자, 특수문자(@$!%*?&)를 각각 1개 이상 포함해야 합니다."
  ],
  "error": "Bad Request"
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

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

---

## 사용 예시

### 이름만 변경
```bash
curl -X PATCH http://localhost:3000/api/v1/mypage/account \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{"name": "김철수"}'
```

### 이메일과 연락처 변경
```bash
curl -X PATCH http://localhost:3000/api/v1/mypage/account \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "phone_number": "010-9876-5432"
  }'
```

### 비밀번호 변경
```bash
curl -X PATCH http://localhost:3000/api/v1/mypage/account/password \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword456!A",
    "confirmPassword": "NewPassword456!A"
  }'
```

---

## 참고사항

### 보안
- 비밀번호는 bcrypt로 해싱하여 저장됩니다.
- 비밀번호 변경 시 현재 비밀번호를 반드시 확인합니다.
- 모든 API는 JWT 인증이 필요합니다.
- 비밀번호 변경 실패는 감사 로그에 기록됩니다.

### 데이터 검증
- DTO(Data Transfer Object)를 통해 요청 데이터를 검증합니다.
- class-validator를 사용하여 타입, 형식, 길이 등을 검증합니다.
- 전화번호는 반드시 하이픈이 포함된 형식이어야 합니다.

### 트랜잭션
- 개인정보 수정과 비밀번호 변경은 트랜잭션으로 처리됩니다.
- 실패 시 자동으로 롤백되어 데이터 일관성을 보장합니다.

### 감사 로그
- 개인정보 변경 시 변경된 필드가 로그에 기록됩니다.
- 비밀번호 변경 성공/실패가 모두 로그에 기록됩니다.
