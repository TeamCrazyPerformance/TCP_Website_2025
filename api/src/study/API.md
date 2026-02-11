# Study API

스터디 관리 API입니다.

---

## 목차

- [1. 스터디 기본](#1-스터디-기본)
- [2. 스터디 멤버 관리](#2-스터디-멤버-관리)
- [3. 스터디 진행 현황](#3-스터디-진행-현황)
- [4. 스터디 자료](#4-스터디-자료)
- [5. 스터디 신청/탈퇴](#5-스터디-신청탈퇴)

---

## 권한 정리

| 권한 | 설명 |
|------|------|
| `Public` | 인증 불필요 |
| `Member` | 로그인한 사용자 |
| `StudyMember` | 해당 스터디의 멤버 (MEMBER 또는 LEADER) |
| `StudyLeader` | 해당 스터디의 리더 |
| `Admin` | 관리자 (모든 스터디에 접근 가능) |

---

## 1. 스터디 기본

### GET /api/v1/study

스터디 목록을 조회합니다.

**권한**: Public

**Request:**
```
GET /api/v1/study
GET /api/v1/study?year=2026
```

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `year` | `number` | 선택 | 필터링할 연도 |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "study_name": "NestJS 심화 스터디",
    "start_year": 2026,
    "study_description": "NestJS를 깊이 있게 공부합니다.",
    "tag": "백엔드",
    "recruit_count": 10,
    "period": "8주",
    "apply_deadline": "2026-01-15T23:59:59.000Z",
    "place": "온라인",
    "way": "매주 토요일 오후 2시",
    "leader_name": "홍길동",
    "members_count": 5
  }
]
```

---

### GET /api/v1/study/:id

스터디 상세 정보를 조회합니다.

**권한**: StudyMember, Admin

**Request:**
```
GET /api/v1/study/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "study_name": "NestJS 심화 스터디",
  "start_year": 2026,
  "study_description": "NestJS를 깊이 있게 공부합니다.",
  "tag": "백엔드",
  "recruit_count": 10,
  "period": "8주",
  "apply_deadline": "2026-01-15T23:59:59.000Z",
  "place": "온라인",
  "way": "매주 토요일 오후 2시",
  "leader": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "홍길동",
    "profile_image": "profile.jpg",
    "role": "LEADER"
  },
  "members": [...],
  "resources": [...],
  "progress": [...]
}
```

---

### POST /api/v1/study

새 스터디를 생성합니다.

**권한**: Admin

**Request:**
```
POST /api/v1/study
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "study_name": "NestJS 심화 스터디",
  "start_year": 2026,
  "study_description": "NestJS를 깊이 있게 공부합니다.",
  "tag": "백엔드",
  "recruit_count": 10,
  "period": "8주",
  "apply_deadline": "2026-01-15T23:59:59.000Z",
  "place": "온라인",
  "way": "매주 토요일 오후 2시",
  "leader_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `study_name` | `string` | 필수 | 스터디 이름 |
| `start_year` | `number` | 필수 | 시작 연도 (2000 이상) |
| `study_description` | `string` | 선택 | 설명 |
| `tag` | `string` | 선택 | 태그 |
| `recruit_count` | `number` | 선택 | 모집 인원 |
| `period` | `string` | 선택 | 진행 기간 |
| `apply_deadline` | `string` | 필수 | 신청 마감일 (ISO 8601) |
| `place` | `string` | 선택 | 장소 |
| `way` | `string` | 선택 | 진행 방식 |
| `leader_id` | `uuid` | 필수 | 리더 사용자 ID |

**Response (201 Created):**
```json
{
  "success": true,
  "id": 1
}
```

---

### PATCH /api/v1/study/:id

스터디 정보를 수정합니다.

**권한**: StudyLeader, Admin

**Request:**
```
PATCH /api/v1/study/1
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "study_name": "NestJS 심화 스터디 (수정)",
  "recruit_count": 15
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### PATCH /api/v1/study/:id/leader

스터디 리더를 변경합니다.

**권한**: Admin

**Request:**
```
PATCH /api/v1/study/1/leader
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### DELETE /api/v1/study/:id

스터디를 삭제합니다.

**권한**: Admin

**Request:**
```
DELETE /api/v1/study/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 2. 스터디 멤버 관리

### GET /api/v1/study/:id/members

스터디 멤버 목록을 조회합니다.

**권한**: StudyMember, Admin

**Request:**
```
GET /api/v1/study/1/members
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
[
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "홍길동",
    "profile_image": "profile.jpg",
    "role": "LEADER"
  },
  {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "김철수",
    "profile_image": "profile2.jpg",
    "role": "MEMBER"
  }
]
```

---

### GET /api/v1/study/:id/members/:userId

특정 멤버의 상세 정보를 조회합니다.

**권한**: StudyLeader, Admin

**Request:**
```
GET /api/v1/study/1/members/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "김철수",
  "profile_image": "profile2.jpg",
  "role": "MEMBER",
  "email": "kim@example.com",
  "phone_number": "010-1234-5678"
}
```

---

### POST /api/v1/study/:id/members

스터디에 멤버를 추가합니다.

**권한**: StudyLeader, Admin

**Request:**
```
POST /api/v1/study/1/members
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440002",
  "role": "MEMBER"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `user_id` | `uuid` | 필수 | 추가할 사용자 ID |
| `role` | `enum` | 필수 | `PENDING`, `MEMBER`, `LEADER` |

**Response (201 Created):**
```json
{
  "success": true,
  "study_member_id": 5
}
```

---

### DELETE /api/v1/study/:id/members/:userId

스터디에서 멤버를 제거합니다.

**권한**: StudyLeader, Admin

**Request:**
```
DELETE /api/v1/study/1/members/550e8400-e29b-41d4-a716-446655440002
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### PATCH /api/v1/study/:id/members/:userId/approve

대기 중인 신청자를 승인합니다 (PENDING → MEMBER).

**권한**: StudyLeader, Admin

**Request:**
```
PATCH /api/v1/study/1/members/550e8400-e29b-41d4-a716-446655440002/approve
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### GET /api/v1/study/:id/available-members

스터디에 추가 가능한 회원을 검색합니다.

**권한**: StudyLeader, Admin

**Request:**
```
GET /api/v1/study/1/available-members?search=홍
Authorization: Bearer <access_token>
```

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `search` | `string` | 선택 | 검색어 (이름) |

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "홍길순",
    "profile_image": "profile3.jpg"
  }
]
```

---

## 3. 스터디 진행 현황

### GET /api/v1/study/:id/progress

스터디 진행 현황 목록을 조회합니다.

**권한**: StudyMember, Admin

**Request:**
```
GET /api/v1/study/1/progress
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "title": "1주차: NestJS 기초",
    "content": "모듈, 컨트롤러, 서비스 개념 학습",
    "created_at": "2026-01-10T10:00:00.000Z"
  }
]
```

---

### POST /api/v1/study/:id/progress

진행 현황을 추가합니다.

**권한**: StudyLeader, Admin

**Request:**
```
POST /api/v1/study/1/progress
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "2주차: TypeORM 연동",
  "content": "데이터베이스 연결 및 엔티티 설계"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | `string` | 필수 | 제목 |
| `content` | `string` | 필수 | 내용 |

**Response (201 Created):**
```json
{
  "success": true,
  "id": 2
}
```

---

### PATCH /api/v1/study/:id/progress/:progressId

진행 현황을 수정합니다.

**권한**: StudyLeader, Admin

**Request:**
```
PATCH /api/v1/study/1/progress/2
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "2주차: TypeORM 연동 (수정)",
  "content": "수정된 내용"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### DELETE /api/v1/study/:id/progress/:progressId

진행 현황을 삭제합니다.

**권한**: StudyLeader, Admin

**Request:**
```
DELETE /api/v1/study/1/progress/2
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 4. 스터디 자료

### GET /api/v1/study/:id/resources

스터디 자료 목록을 조회합니다.

**권한**: StudyMember, Admin

**Request:**
```
GET /api/v1/study/1/resources
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "file_name": "1주차_자료.pdf",
    "file_path": "/uploads/resources/1-abc123.pdf",
    "created_at": "2026-01-10T10:00:00.000Z"
  }
]
```

---

### POST /api/v1/study/:id/resources

스터디 자료를 업로드합니다.

**권한**: StudyLeader, Admin

**Request:**
```
POST /api/v1/study/1/resources
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | `file` | 필수 | 파일 (pdf, docx, pptx) |

**제한사항:**
- 최대 파일 크기: 10MB
- 허용 형식: pdf, docx, pptx

**Response (201 Created):**
```json
{
  "id": 2,
  "file_name": "2주차_자료.pdf",
  "file_path": "/uploads/resources/1-def456.pdf",
  "created_at": "2026-01-17T10:00:00.000Z"
}
```

---

### GET /api/v1/study/:id/resources/:resourceId/download

스터디 자료를 다운로드합니다.

**권한**: StudyMember, Admin

**Request:**
```
GET /api/v1/study/1/resources/1/download
Authorization: Bearer <access_token>
```

**Response:** 파일 스트림 (Content-Disposition 헤더 포함)

---

### DELETE /api/v1/study/:id/resources/:resourceId

스터디 자료를 삭제합니다.

**권한**: StudyLeader, Admin

**Request:**
```
DELETE /api/v1/study/1/resources/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 5. 스터디 신청/탈퇴

### POST /api/v1/study/:id/apply

스터디에 신청합니다 (PENDING 상태로 추가).

**권한**: Member

**Request:**
```
POST /api/v1/study/1/apply
Authorization: Bearer <access_token>
```

**Response (201 Created):**
```json
{
  "success": true
}
```

---

### DELETE /api/v1/study/:id/leave

스터디에서 탈퇴합니다.

**권한**: 로그인한 사용자 (본인만)

**Request:**
```
DELETE /api/v1/study/1/leave
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
  "message": "Study with ID 999 not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "User is already a member of this study",
  "error": "Conflict"
}
```
