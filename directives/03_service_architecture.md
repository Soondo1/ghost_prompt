# DIRECTIVE: Service Architecture — Prompt Ghost

> **PFA Layer:** 1 (Directive)
> **Status:** Draft — Pending Approval
> **Last Updated:** 2026-06-17

---

## 1. Service Inventory

The system decomposes into **6 logical services**, currently collapsed into 2 physical deployments (extension + single Vercel function). The target architecture separates concerns for reliability, testability, and scalability.

---

## 2. Service Decomposition

### 2.1 Current Services (As-Is)

| # | Service | Physical Location | Responsibility |
|---|---|---|---|
| S1 | Content Script | Chrome tab process | DOM detection, ghost rendering, user input |
| S2 | Background Worker | Chrome service worker | Message routing, API relay |
| S3 | Popup UI | Chrome popup window | Manual transform, settings, UX |
| S4 | API Server | Vercel serverless (`server.js`) | Gemini orchestration, response formatting |

### 2.2 Target Services (To-Be)

| # | Service | Physical Location | Responsibility |
|---|---|---|---|
| S1 | Content Script | Chrome tab process | DOM detection, ghost rendering, user input |
| S2 | Background Worker | Chrome service worker | Message routing, auth token management, request queueing |
| S3 | Popup UI | Chrome popup window | Manual transform, settings, history, auth UI |
| S4 | API Gateway | Vercel serverless | Auth middleware, rate limiting, request routing |
| S5 | Optimization Engine | Vercel serverless | Gemini calls, prompt caching, response formatting |
| S6 | Data Service | Supabase (managed) | User data, history, analytics, error logging |

---

## 3. Service Contracts (API Specification)

### 3.1 POST `/optimize` — Live Ghost Suggestion

**Current Implementation** — No changes to external contract.

```
Request:
  POST /optimize
  Content-Type: application/json
  Authorization: Bearer <token>    ← NEW

  {
    "prompt": "string (required)",
    "level": "concise | detailed (default: concise)"
  }

Response (200):
  {
    "optimized": "string",
    "cached": true | false,           ← NEW
    "tokens_used": 42                 ← NEW
  }

Response (401):
  { "error": "Unauthorized" }

Response (429):
  { "error": "Rate limit exceeded", "retry_after": 60 }

Response (500):
  { "error": "Optimization failed" }
```

### 3.2 POST `/transform` — Manual Two-Variation Transform

```
Request:
  POST /transform
  Content-Type: application/json
  Authorization: Bearer <token>    ← NEW

  {
    "prompt": "string (required)"
  }

Response (200):
  {
    "results": ["string", "string"],
    "tokens_used": 87               ← NEW
  }

Response (401 / 429 / 500): Same as /optimize
```

### 3.3 POST `/auth/signup` — New User Registration *(NEW)*

```
Request:
  POST /auth/signup
  Content-Type: application/json

  {
    "email": "string (required)",
    "password": "string (required, min 8 chars)"
  }

Response (201):
  {
    "user": { "id": "uuid", "email": "string" },
    "access_token": "string",
    "refresh_token": "string"
  }

Response (409):
  { "error": "Email already registered" }
```

### 3.4 POST `/auth/login` — User Authentication *(NEW)*

```
Request:
  POST /auth/login
  Content-Type: application/json

  {
    "email": "string (required)",
    "password": "string (required)"
  }

Response (200):
  {
    "user": { "id": "uuid", "email": "string", "plan_tier": "free" },
    "access_token": "string",
    "refresh_token": "string"
  }

Response (401):
  { "error": "Invalid credentials" }
```

### 3.5 GET `/history` — Prompt History Feed *(NEW)*

```
Request:
  GET /history?page=1&limit=20
  Authorization: Bearer <token>

Response (200):
  {
    "items": [
      {
        "id": "uuid",
        "original_prompt": "string",
        "optimized_prompt": "string",
        "optimization_level": "concise",
        "platform": "chatgpt.com",
        "was_accepted": true,
        "created_at": "ISO8601"
      }
    ],
    "total": 142,
    "page": 1,
    "pages": 8
  }
```

### 3.6 GET `/usage` — Usage Statistics *(NEW)*

```
Request:
  GET /usage?days=30
  Authorization: Bearer <token>

Response (200):
  {
    "daily_remaining": 37,
    "daily_limit": 50,
    "stats": [
      {
        "date": "2026-06-17",
        "optimize_count": 13,
        "transform_count": 2,
        "tokens_used": 1847,
        "cached_hits": 5
      }
    ]
  }
```

---

## 4. Middleware Pipeline

Every API request passes through a layered middleware stack:

```
Incoming Request
       │
       ▼
┌─────────────────┐
│  1. CORS        │  Allow extension origin
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. JSON Parser │  express.json()
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. Auth Check  │  Validate Supabase JWT
│                 │  Attach user to req
│                 │  Reject 401 if invalid
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. Rate Limiter│  Check usage_stats
│                 │  Reject 429 if over limit
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. Cache Check │  Hash prompt → check cache
│                 │  Return cached if hit
└────────┬────────┘
         ▼
┌─────────────────┐
│  6. Route       │  /optimize, /transform,
│     Handler     │  /auth/*, /history, /usage
└────────┬────────┘
         ▼
┌─────────────────┐
│  7. Logger      │  Write to error_log
│                 │  Update usage_stats
└─────────────────┘
```

---

## 5. Chrome Extension Message Protocol

### 5.1 Content Script → Background Worker

| Action | Payload | Response |
|---|---|---|
| `fetchSuggestion` | `{ prompt, level }` | `{ success, data: { optimized, cached } }` |
| `reportAcceptance` | `{ historyId }` | `{ success }` |

### 5.2 Popup → Background Worker

| Action | Payload | Response |
|---|---|---|
| `transformText` | `{ prompt }` | `{ success, data: { results } }` |
| `login` | `{ email, password }` | `{ success, user, token }` |
| `signup` | `{ email, password }` | `{ success, user, token }` |
| `logout` | `{}` | `{ success }` |
| `getHistory` | `{ page, limit }` | `{ success, data: { items, total } }` |
| `getUsage` | `{ days }` | `{ success, data: { ... } }` |
| `getAuthState` | `{}` | `{ loggedIn, user }` |

### 5.3 Background Worker Internal State

| Key | Storage | Description |
|---|---|---|
| `access_token` | `chrome.storage.local` | Supabase JWT (not synced for security) |
| `refresh_token` | `chrome.storage.local` | Refresh token |
| `user` | `chrome.storage.local` | Cached user object |
| `enabled` | `chrome.storage.sync` | Ghost overlay toggle (existing) |
| `optimizationLevel` | `chrome.storage.sync` | Concise/detailed (existing) |

---

## 6. Error Handling Strategy

### 6.1 Client-Side (Content Script & Popup)

| Error Type | Behavior |
|---|---|
| Network timeout (>5s) | Clear ghost, show no error (silent fail for overlay) |
| 401 Unauthorized | Redirect to popup login UI |
| 429 Rate limited | Show subtle toast: "Daily limit reached" |
| 500 Server error | Log to console, clear ghost silently |
| Extension disconnect | Re-inject content script on next navigation |

### 6.2 Server-Side (Self-Annealing per PFA §3)

| Error Type | Recovery Action |
|---|---|
| Gemini API timeout | Retry once with exponential backoff (2s), then return 500 |
| Gemini rate limit (429) | Queue request, retry after `Retry-After` header value |
| Gemini content filter | Return empty optimization with `filtered: true` flag |
| Supabase connection fail | Log error, serve request without DB (degrade gracefully) |
| Malformed prompt input | Return 400 with validation message |
| Unknown error | Log full stack to `error_log`, return generic 500 |

---

## 7. Performance Requirements

| Metric | Target | Current |
|---|---|---|
| Overlay suggestion latency (P95) | < 2,000ms | ~1,500ms (estimated, no telemetry) |
| Popup transform latency (P95) | < 3,000ms | Unknown |
| Cache hit rate | > 30% | 0% (no cache exists) |
| API availability | 99.5% | Unknown (no monitoring) |
| Content script injection | < 50ms | ~10ms (lightweight IIFE) |
| Popup load time | < 500ms | ~300ms (Vite-built React) |

---

## 8. Scalability Considerations

| Dimension | Strategy |
|---|---|
| **Users** | Supabase handles auth at scale; Vercel auto-scales serverless functions |
| **API calls** | Prompt caching reduces Gemini calls by ~30%; rate limiting prevents abuse |
| **Data** | PostgreSQL indexes on common queries; 90-day retention for free tier |
| **Cost** | Free tiers of Vercel + Supabase + Gemini cover ~1,000 daily active users |
| **Multi-model** | Abstract Gemini calls behind a provider interface for future model switching |

---

## 9. Cross-References

- **System Architecture →** `directives/01_system_architecture.md`
- **Database Architecture →** `directives/02_database_architecture.md`
- **Execution Script Plan →** `directives/04_execution_script_plan.md`
- **Risk Analysis →** `directives/05_risk_analysis.md`
