# Security Audit Report

## Issues Found & Fixed

### 1. Missing Rate Limiting

**Before:** No rate limiting on any endpoint
**After:** Added three tiers of rate limiting:

- General: 200 requests per 15 minutes
- Auth: 20 requests per 15 minutes
- AI: 10 requests per minute

### 2. Permissive CORS

**Before:** `origin: '*'` allowing any domain
**After:** Configurable via `CORS_ORIGIN` env var, defaults to false in production

### 3. Hardcoded JWT Secret

**Before:** Fallback to `'ncet_super_secret_key_2024'`
**After:** Required env var, server exits if not set

### 4. SQL Injection in ORDER BY

**Before:** Direct string interpolation: `ORDER BY ${sort}`
**After:** Whitelist-based lookup: `sortMap[sort] || sortMap.semester`

### 5. Missing Authorization on Deletes

**Before:** Any authenticated user could delete any subject/paper/note
**After:** `isOwnerOrAdmin()` checks `created_by` field

### 6. Missing Global Error Handler

**Before:** Stack traces leaked to client
**After:** Production-safe error messages, detailed in development only

### 7. Missing Security Headers

**Before:** No helmet, no CSP
**After:** Helmet with CSP directives configured

### 8. Oversized Body Parser

**Before:** 50MB JSON body limit
**After:** 10MB limit (still generous for base64 uploads)

### 9. Missing 404 Handler

**Before:** Express default HTML 404
**After:** JSON 404 response for API consistency

## Remaining Risks

1. **File Upload:** Still allows PDF uploads - consider virus scanning
2. **AI Prompt Injection:** User questions passed directly to AI - monitor for abuse
3. **No HTTPS enforcement:** Add reverse proxy (nginx/traefik) in production
4. **Database:** No connection encryption verification for self-hosted DBs
5. **Logging:** No audit log for sensitive operations

## Recommendations

1. Add `express-slow-down` for additional brute-force protection
2. Implement API key rotation mechanism
3. Add request ID logging for traceability
4. Consider adding `express-mongo-sanitize` equivalent for NoSQL injection
5. Set up monitoring (Sentry/DataDog) for production errors
