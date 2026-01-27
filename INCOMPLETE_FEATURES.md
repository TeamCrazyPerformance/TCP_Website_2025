# TCP Website 2025 - Incomplete Features & Technical Debt

> **Last Updated**: 2026-01-26  
> **Purpose**: Comprehensive list of incomplete features organized by priority with responsibility and fix-type tags

---

## 📊 Quick Stats

- **Total Issues**: 36
- **Critical (P0)**: 5 items
- **High Priority (P1)**: 13 items
- **Medium Priority (P2)**: 15 items
- **Low Priority (P3)**: 3 items

**Estimated Completion**: 8-10 weeks for all priorities

---

## Tag Legend

### Responsibility Tags
- `[Server]` - Server/Infrastructure configuration
- `[Backend]` - NestJS API code
- `[Frontend]` - React application code
- `[Database]` - Database schema/migrations
- `[DevOps]` - Deployment/CI/CD

### Fix Type Tags
- `[Security]` - Security vulnerability or improvement
- `[Configuration]` - Configuration file changes
- `[Feature]` - New feature implementation
- `[Integration]` - API/service integration
- `[Bug Fix]` - Fixing broken functionality
- `[Code Quality]` - Code cleanup/refactoring
- `[UX]` - User experience improvement
- `[UI]` - User interface improvement
- `[Performance]` - Performance optimization
- `[Data]` - Data management/migration

---

## 🔴 Critical Priority (P0) - BLOCKER

> Must be completed before production deployment

### 1. [Server][Security] Missing SSL Certificates

**Impact**: HTTPS configured but non-functional  
**Location**: `reverse-proxy/certs/`  
**Effort**: Low

**Issue**: Only `.gitkeep` file exists, but nginx expects:
- `/etc/nginx/certs/fullchain.pem`
- `/etc/nginx/certs/privkey.pem`

**Fix**:
```bash
# Option 1: Let's Encrypt
certbot certonly --standalone -d your-domain.com

# Option 2: Manual certificates
cp /path/to/fullchain.pem reverse-proxy/certs/
cp /path/to/privkey.pem reverse-proxy/certs/
```

---

### 2. [Server][Configuration] Default Domain in Nginx Config

**Impact**: Server won't respond to real domain  
**Location**: `reverse-proxy/default.conf:14`  
**Effort**: Low

**Current**:
```nginx
server_name your-domain.com;  # 추후 실제 도메인으로 교체
```

**Fix**: Replace with actual domain name(s)

---

### 3. [Server][Configuration] Empty Web Environment File

**Impact**: Frontend environment not configured  
**Location**: `envs/web.env` (0 bytes)  
**Effort**: Low

**Required Variables**:
```bash
REACT_APP_API_BASE_URL=https://your-domain.com
REACT_APP_ENV=production
```

---

### 4. [Server][Backend][Security] Default Passwords

**Impact**: Critical security vulnerability  
**Location**: Multiple env files  
**Effort**: Low

**Files to Update**:
- `envs/api.env` → `JWT_SECRET`
- `envs/db_dev.env` + `envs/db_prod.env` → `ADMIN_PASSWORD`, `DB_PASSWORD`
- `envs/elk.env` → `ELASTIC_PASSWORD`, `KIBANA_SYSTEM_PASSWORD`

**Fix**: Generate strong secrets with `openssl rand -base64 64`

---

### 5. [Backend][Bug Fix] Missing Default Profile Image

**Impact**: Broken profile images for new users  
**Location**: `api/src/members/entities/user.entity.ts:34`  
**Effort**: Low

**Code**:
```typescript
// TODO 기본 프로필 이미지 추가해야 함
@Column({ type: 'varchar', length: 255, default: 'default_profile_image.png' })
profile_image: string;
```

**Fix**: Create default image or use avatar API

---

## 🟡 High Priority (P1) - CORE FUNCTIONALITY

> Required for basic app functionality

### 6. [Frontend][Backend][Feature] Admin Pages Use Static Mock Data

**Impact**: Admin panel completely non-functional  
**Location**: All `pages/admin/*.jsx`  
**Effort**: High

**Affected Files**:
- `AdminServer.jsx` - Hardcoded metrics, no real monitoring
- `AdminPermission.jsx` - Sample users array (10 hardcoded users)
- `AdminTeam.jsx` - Sample teams array
- `AdminApplicationManagement.jsx` - Static data
- `AdminModifyUserInfo.jsx` - No backend connection

**Fix**: Create corresponding backend endpoints and replace mock data with API calls

---

### 6.5. [Frontend][Integration] MyPage Pages Not Connected to Backend APIs

**Impact**: User profile features non-functional  
**Location**: All `pages/mypage/*.jsx`  
**Effort**: Medium

**Issue**: Backend endpoints exist but frontend doesn't call them

**Affected Files**:
- `Profile.jsx` - Uses hardcoded mock profile data, `alert()` on save (Lines 16-28, 218-220)
- `MyPageAccountSettings.jsx` - Mock fetched data, no real API calls (Lines 10-13, 28-30)
- `MyStudies.jsx` - Hardcoded study data array (Lines 3-12)
- `MyTeams.jsx` - Hardcoded teams array with 5 mock teams (Lines 15-200)

**Backend APIs Available** (not being used):
```typescript
GET  /api/v1/mypage/profile      // Get user profile
PATCH /api/v1/mypage/profile     // Update profile

GET  /api/v1/mypage/account      // Get account info
PATCH /api/v1/mypage/account     // Update account
PATCH /api/v1/mypage/account/password  // Change password

// Study and Teams endpoints also exist
```

**Fix**:
1. Import API client in each MyPage component
2. Replace useState initial data with API calls using useEffect
3. Replace save handlers (alert()) with actual API POST/PATCH calls
4. Add loading states and error handling
5. Add success/error toast notifications

**Example Fix for Profile.jsx**:
```javascript
import { apiGet, apiPost } from '../api/client';

useEffect(() => {
  apiGet('/api/v1/mypage/profile')
    .then(data => setProfile(data))
    .catch(err => console.error(err));
}, []);

const saveProfileSettings = async () => {
  try {
    await apiPost('/api/v1/mypage/profile', profile);
    toast.success('Profile updated!');
  } catch (error) {
    toast.error('Failed to update profile');
  }
};
```

---

### 7. [Frontend][UI] Extensive Placeholder Image Usage

**Impact**: Not production-ready, external dependency  
**Location**: 85+ instances across frontend  
**Effort**: Medium

**Affected Components**:
- User profiles, avatars
- Team cards
- Activity images
- All using `https://via.placeholder.com/...`

**Fix**: Replace with UI Avatar API or local SVG generator

---

### 8. [Frontend][Bug Fix] Missing User Authentication State

**Impact**: Authorization not working  
**Location**: `StudyDetail.jsx:12`  
**Effort**: Medium

**Code**:
```javascript
// TODO: 실제 사용자 인증 정보를 바탕으로 역할을 결정해야 함
const userRole = 'leader'; // Hardcoded!
```

**Fix**: Implement auth context/hook with real user data

---

### 9. [Server][Configuration] Nginx Configuration Incomplete

**Impact**: Missing optimization and security  
**Location**: `reverse-proxy/default.conf`  
**Effort**: Medium

**Missing**:
- Rate limiting
- Gzip compression
- Security headers
- Static asset caching

**Fix**: Add comprehensive nginx config

---

### 10. [Backend][Database][Configuration] Production Database Sync

**Impact**: Risk of data loss  
**Location**: `api/src/app.module.ts:42`  
**Effort**: Low

**Code**:
```typescript
synchronize: true, // 개발 중에만 true
```

**Fix**: 
```typescript
synchronize: config.get<string>('NODE_ENV') !== 'production',
```

---

### 11. [Backend][Database][Data] No Database Migration System

**Impact**: Cannot safely update schema  
**Location**: Project-wide  
**Effort**: Medium

**Issue**: No migrations exist, relying on dangerous auto-sync

**Fix**:
```bash
npm run migration:generate -- src/migrations/InitialSchema
npm run migration:run
```

---

### 12. [Server][Backend][Integration] Missing Redis Configuration

**Impact**: Caching not functional  
**Location**: Docker Compose, Backend  
**Effort**: Medium

**Issue**: AdminServer references Redis but it's not configured anywhere

**Fix**: Add Redis container to `docker-compose.yml` and configure backend client

---

### 13. [Backend][Security] No API Rate Limiting

**Impact**: Vulnerable to abuse  
**Location**: Backend middleware  
**Effort**: Low

**Fix**: Add `@nestjs/throttler` package

---

### 14. [Frontend][Code Quality] Build Warnings

**Impact**: Code quality issues  
**Location**: 7 files with ESLint warnings  
**Effort**: Low

**Files**:
- `Team.jsx` - Missing useEffect dependency
- `AdminApplicationManagement.jsx` - Unused useMemo
- `AdminModifyUserInfo.jsx` - Unused handleSelectUser
- `AdminPermission.jsx` - Unused hooks/state
- `AdminServer.jsx` - Unused variables
- `AdminTeam.jsx` - Unused state setters
- `MyPageSettings.jsx` - Invalid anchor hrefs

**Fix**: Remove unused code, fix React hooks

---

### 15. [Frontend][Bug Fix] Incomplete Navigation

**Impact**: Poor user experience  
**Location**: `StudyDetail.jsx:110`  
**Effort**: Low

**Code**:
```javascript
// TODO: navigate to /study
console.log('스터디를 성공적으로 생성했습니다!');
```

**Fix**: Add `navigate('/study')` after successful creation

---

### 16. [Backend][Feature] Missing Email Notification System

**Impact**: No user notifications  
**Location**: Project-wide  
**Effort**: High

**Use Cases**:
- Application status updates
- Password reset
- Team invitations
- Study updates

**Fix**: Integrate email service (SendGrid/AWS SES)

---

### 17. [Backend][Feature] No Password Reset Functionality

**Impact**: Users locked out if password forgotten  
**Location**: `api/src/auth/`  
**Effort**: Medium

**Fix**: Implement forgot password flow with email verification

---

## 🟠 Medium Priority (P2) - UX & QUALITY

> Important for good user experience

### 18. [Backend][Feature] Incomplete Health Checks

**Impact**: Cannot monitor system health  
**Location**: `api/src/health/`  
**Effort**: Medium

**Missing Checks**:
- Redis connection
- Elasticsearch connection
- Disk space
- Memory usage

**Fix**: Expand health check service

---

### 19. [Backend][Feature] Incomplete Admin System Metrics

**Impact**: Admin can't monitor server  
**Location**: `api/src/admin/system/`  
**Effort**: High

**Missing Endpoints**:
- CPU usage (real-time)
- Memory usage
- Disk usage
- Network stats
- Service statuses

**Fix**: Integrate `systeminformation` package properly

---

### 20. [Backend][Security] No File Upload Validation

**Impact**: Security risk  
**Location**: Study, Teams, Recruitment modules  
**Effort**: Medium

**Missing**:
- File size limits
- File type restrictions
- Virus scanning

**Fix**: Add multer validation middleware

---

### 21. [Backend][Code Quality] Inconsistent Error Handling

**Impact**: Unpredictable API responses  
**Location**: All services  
**Effort**: Medium

**Issue**: Some throw errors, some return null

**Fix**: Create global exception filter with standardized responses

---

### 22. [Backend][Feature] No API Documentation

**Impact**: Frontend devs must read code  
**Location**: API endpoints  
**Effort**: Medium

**Fix**: Add `@nestjs/swagger` and generate OpenAPI spec

---

### 23. [Backend][Feature] No Search Functionality

**Impact**: Hard to find content  
**Location**: Members, Announcements  
**Effort**: Medium

**Missing Search**:
- Full member directory
- Announcements
- Better study/team search

**Fix**: Implement backend search with query params

---

### 24. [Backend][Frontend][Performance] No Pagination

**Impact**: Slow with large datasets  
**Location**: All list pages  
**Effort**: Medium

**Affected**:
- Members list
- Announcements list
- Studies list
- Teams list
- Applications list

**Fix**: Implement cursor/offset pagination

---

### 25. [Server][Data] No File Storage Strategy

**Impact**: Not scalable  
**Location**: `api/uploads/`  
**Effort**: High

**Current Issues**:
- Local storage in container
- No backup
- No CDN

**Fix**: Migrate to S3/Cloudflare R2

---

### 26. [Frontend][UX] No Error Boundaries

**Impact**: One error crashes entire app  
**Location**: App structure  
**Effort**: Low

**Fix**: Implement React Error Boundary components

---

### 27. [Frontend][UX] No Input Validation

**Impact**: Poor user experience  
**Location**: All form components  
**Effort**: Medium

**Fix**: Add react-hook-form or formik with validation

---

### 28. [Frontend][Feature] No Loading States

**Impact**: Appears broken during data fetch  
**Location**: Most pages  
**Effort**: Medium

**Fix**: Add loading spinners/skeletons to all data-fetching components

---

### 29. [Frontend][UX] No Toast/Notification System

**Impact**: No user feedback  
**Location**: Project-wide  
**Effort**: Low

**Current**: All feedback via console.log

**Fix**: Add react-hot-toast or similar library

---

### 30. [Frontend][Code Quality] No Frontend Logging

**Impact**: Can't debug production issues  
**Location**: Frontend  
**Effort**: Medium

**Fix**: Add Sentry or LogRocket

---

### 31. [Frontend][Code Quality] TypeScript Not Used

**Impact**: No type safety  
**Location**: Entire frontend  
**Effort**: High

**Fix**: Migrate gradually, start with new components

---

### 32. [Frontend][Backend][Feature] No Real-time Features

**Impact**: Missing live updates  
**Location**: Project-wide  
**Effort**: High

**Potential Use Cases**:
- Live notifications
- Real-time dashboard
- Chat features

**Fix**: Add WebSocket support with Socket.io

---

## 🟢 Low Priority (P3) - ENHANCEMENTS

> Nice-to-have features for future

### 33. [Backend][Integration] No GitHub API Integration

**Impact**: Cannot verify GitHub profiles  
**Location**: User profiles  
**Effort**: Low

**Fix**: Fetch and display user's repos from GitHub API

---

### 34. [Backend][Integration] No Baekjoon API Integration

**Impact**: Cannot show algorithm stats  
**Location**: User profiles  
**Effort**: Low

**Fix**: Use Solved.ac API for Baekjoon stats

---

### 35. [Frontend][Backend][Feature] No Analytics

**Impact**: No usage insights  
**Location**: Project-wide  
**Effort**: Medium

**Missing Metrics**:
- Page views
- User engagement
- Conversion rates

**Fix**: Add Google Analytics or Plausible

---

## 📋 Implementation Roadmap

### Phase 1: Pre-Production (1-2 weeks)
**Goal**: Make deployable

- [x] Issue #1: SSL Certificates
- [x] Issue #2: Domain Configuration
- [x] Issue #3: Web Environment
- [x] Issue #4: Default Passwords
- [x] Issue #5: Default Profile Image
- [x] Issue #10: Production DB Sync
- [x] Issue #11: Database Migrations

**Success Criteria**: Can deploy to production safely

---

### Phase 2: Core Functionality (3-4 weeks)
**Goal**: Make fully functional

- [x] Issue #6: Connect Admin Pages
- [x] Issue #7: Replace Placeholder Images
- [x] Issue #8: Auth State Management
- [x] Issue #12: Redis Integration
- [x] Issue #13: Rate Limiting
- [x] Issue #14: Fix Build Warnings
- [x] Issue #15: Complete Navigation
- [x] Issue #16: Email Notifications
- [x] Issue #17: Password Reset

**Success Criteria**: All core features working with real data

---

### Phase 3: Polish & UX (2-3 weeks)
**Goal**: Professional user experience

- [x] Issue #18-32: All Medium Priority items
  - Health checks, metrics
  - File upload validation
  - Error handling standardization
  - Search & pagination
  - Loading states & notifications
  - Error boundaries
  - Input validation

**Success Criteria**: Smooth, professional user experience

---

### Phase 4: Enhancements (Ongoing)
**Goal**: Advanced features

- [x] Issue #33-35: All Low Priority items
  - GitHub integration
  - Baekjoon integration
  - Analytics
  - TypeScript migration
  - WebSocket features

**Success Criteria**: Feature-complete platform

---

## 📊 Responsibility Breakdown

### Server Team (DevOps)
- Issues: #1, #2, #3, #4, #9, #12, #25
- **Total**: 7 items
- **Effort**: 2-3 weeks

### Backend Team
- Issues: #4, #5, #11, #13, #16, #17, #18, #19, #20, #21, #22, #23, #24, #33, #34
- **Total**: 15 items
- **Effort**: 5-6 weeks

### Frontend Team
- Issues: #6, #7, #8, #14, #15, #26, #27, #28, #29, #30, #31, #35
- **Total**: 12 items
- **Effort**: 4-5 weeks

### Database Team
- Issues: #10, #11
- **Total**: 2 items
- **Effort**: 1 week

### Cross-functional
- Issues: #6, #24, #32, #35
- **Total**: 4 items
- **Effort**: 2-3 weeks

---

## 🎯 Quick Priority Checklist

### Must Complete (Critical + High)
```
Critical (P0) - 5 items:
□ SSL Certificates
□ Domain Configuration  
□ Web Environment
□ Default Passwords
□ Default Profile Image

High (P1) - 12 items:
□ Admin Panel Integration
□ Replace Placeholder Images
□ Auth State Management
□ Nginx Optimization
□ Production DB Sync
□ Database Migrations
□ Redis Integration
□ Rate Limiting
□ Fix Build Warnings
□ Complete Navigation
□ Email Notifications
□ Password Reset
```

### Should Complete (Medium)
```
Medium (P2) - 15 items:
□ Health Checks
□ System Metrics
□ File Upload Validation
□ Error Handling
□ API Documentation
□ Search Functionality
□ Pagination
□ File Storage Strategy
□ Error Boundaries
□ Input Validation
□ Loading States
□ Toast Notifications
□ Frontend Logging
□ TypeScript Migration
□ WebSocket Support
```

### Nice to Have (Low)
```
Low (P3) - 8 items:
□ GitHub Integration
□ Baekjoon Integration
□ Analytics
```

---

## 📈 Progress Tracking

**Current Status**: ~70% Complete

| Priority | Complete | Total | Percentage |
|----------|---------|--------|------------|
| Critical (P0) | 0 | 5 | 0% |
| High (P1) | 0 | 12 | 0% |
| Medium (P2) | 0 | 15 | 0% |
| Low (P3) | 0 | 8 | 0% |
| **TOTAL** | **0** | **40** | **0%** |

---

## 🎓 Conclusion

The project has a **solid foundation** but requires significant work:

**Strengths**:
- Modern tech stack
- Docker deployment ready
- Comprehensive feature set
- Good code organization

**Critical Gaps**:
- Deployment config incomplete
- Admin panel non-functional
- Security vulnerabilities
- Missing production essentials

**Recommended Focus**:
1. Week 1-2: Fix all P0 issues (deployment ready)
2. Week 3-6: Complete P1 items (fully functional)
3. Week 7-9: Address P2 items (professional UX)
4. Week 10+: P3 enhancements (optional)

**Total Effort**: 8-10 weeks to production-ready

---

**Document Version**: 2.0  
**Last Updated**: 2026-01-26  
**Next Review**: After Phase 1 completion
