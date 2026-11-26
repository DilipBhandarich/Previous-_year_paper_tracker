# Production Readiness TODO

## Phase 1: Security Hardening

- [x] Add helmet, express-rate-limit, compression middleware
- [x] Fix CORS to use configurable origin
- [x] Remove hardcoded JWT_SECRET fallback
- [x] Add XSS sanitization for user-generated content
- [x] Fix SQL injection in dynamic ORDER BY (whitelist approach)
- [x] Add global error handler masking internal errors
- [x] Add ownership/role checks to DELETE endpoints (isOwnerOrAdmin)

## Phase 2: Bug Fixes

- [x] Add limit/offset pagination to list endpoints
- [x] Fix Dashboard to use pagination
- [x] Fix Notes/Subjects/Papers delete authorization
- [x] Add missing API 404 handler
- [x] Add created_by tracking to subjects, papers, notes

## Phase 3: Testing Infrastructure

- [x] Install backend test deps (jest, supertest) - already present
- [x] Install frontend test deps (vitest, testing-library, jsdom)
- [x] Create server test suite (auth, api, security)
- [x] Create client unit tests (AuthContext, utils)
- [x] Create E2E tests (Playwright config + critical flows)

## Phase 4: Run & Fix

- [ ] Run backend tests
- [ ] Run frontend tests
- [ ] Fix any failures

## Phase 5: Performance

- [x] Add compression middleware
- [x] Implement pagination on all list endpoints
- [x] Reduced body size limits from 50MB to 10MB
- [x] Optimized upload limits (20MB per file, max 10 files)

## Phase 6: Final Validation

- [ ] Security scan verification
- [ ] Build verification
- [ ] Summarize results
