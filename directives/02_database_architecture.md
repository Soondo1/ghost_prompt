# DIRECTIVE: Database Architecture — Prompt Ghost

> **PFA Layer:** 1 (Directive)
> **Status:** Draft — Pending Approval
> **Last Updated:** 2026-06-17

---

## 1. Current State Assessment

Prompt Ghost currently has **zero persistence**. There is no database, no local storage schema beyond `chrome.storage.sync` (which stores only two boolean/string settings), and no server-side data retention. Every API call to Gemini is fire-and-forget.

### Current Storage Inventory

| Store | Location | Data | Persistence |
|---|---|---|---|
| `chrome.storage.sync` | Browser (Chrome profile) | `enabled: boolean`, `optimizationLevel: string` | Persisted, synced across devices |
| In-memory variables | Content script runtime | `suggestion`, `currentTarget`, `lastPromptFetched` | Volatile — lost on page navigation |
| Vercel env vars | Vercel dashboard | `GEMINI_API_KEY` | Persistent (server-side only) |
| `.env` file | Local dev machine | `GEMINI_API_KEY` | Local only |

### What's Missing

- No prompt history storage
- No user identity or account system
- No usage tracking / billing meters
- No prompt performance analytics
- No response caching layer
- No audit log for API calls

---

## 2. Recommended Database: Supabase (PostgreSQL)

### Why Supabase

| Criterion | Supabase | Firebase | PlanetScale |
|---|---|---|---|
| Free tier | ✅ 500MB, 2 projects | ✅ Spark plan | ✅ 5GB |
| SQL support | ✅ Full PostgreSQL | ❌ NoSQL only | ✅ MySQL |
| Auth built-in | ✅ GoTrue (email, OAuth) | ✅ Firebase Auth | ❌ None |
| Real-time | ✅ Postgres Changes | ✅ Firestore listeners | ❌ None |
| Row-level security | ✅ Native RLS | ⚠️ Security rules | ❌ App-level |
| Edge Functions | ✅ Deno-based | ✅ Cloud Functions | ❌ None |
| Vercel integration | ✅ First-class | ⚠️ Manual | ✅ First-class |
| Complexity | Low | Low | Medium |

**Recommendation:** Supabase — it provides auth, database, and real-time in a single service, integrates natively with Vercel, and offers PostgreSQL's full power for analytics queries.

---

## 3. Schema Design

### 3.1 Entity-Relationship Diagram

```
┌──────────────┐       ┌───────────────────┐       ┌──────────────────┐
│   users      │       │   prompt_history   │       │   usage_stats    │
├──────────────┤       ├───────────────────┤       ├──────────────────┤
│ id (PK)      │──┐    │ id (PK)           │       │ id (PK)          │
│ email        │  │    │ user_id (FK)      │◄──┐   │ user_id (FK)     │
│ display_name │  │    │ original_prompt   │   │   │ date             │
│ plan_tier    │  └───►│ optimized_prompt  │   │   │ optimize_count   │
│ api_key_hash │       │ optimization_level│   │   │ transform_count  │
│ created_at   │       │ platform          │   │   │ tokens_used      │
│ updated_at   │       │ was_accepted      │   │   │ cached_hits      │
└──────────────┘       │ response_time_ms  │   │   └──────────────────┘
                       │ tokens_used       │   │
                       │ created_at        │   │
                       └───────────────────┘   │
                                               │
┌──────────────────┐       ┌───────────────────┤
│   cache_entries  │       │   error_log       │
├──────────────────┤       ├───────────────────┤
│ id (PK)          │       │ id (PK)           │
│ prompt_hash (UQ) │       │ user_id (FK)      │
│ level            │       │ endpoint          │
│ optimized_text   │       │ error_type        │
│ hit_count        │       │ error_message     │
│ created_at       │       │ stack_trace       │
│ expires_at       │       │ request_payload   │
└──────────────────┘       │ created_at        │
                           └───────────────────┘
```

### 3.2 Table Definitions

#### `users`
Stores authenticated user profiles and subscription tier.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Supabase Auth user ID |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | User email |
| `display_name` | `VARCHAR(100)` | NULLABLE | Optional display name |
| `plan_tier` | `VARCHAR(20)` | DEFAULT `'free'` | `free`, `pro`, `team` |
| `daily_limit` | `INTEGER` | DEFAULT `50` | Max optimize calls/day |
| `api_key_hash` | `VARCHAR(64)` | NULLABLE | SHA-256 of personal API key override |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Account creation |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Last profile update |

#### `prompt_history`
Stores every optimization interaction for history and analytics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Record ID |
| `user_id` | `UUID` | FK → `users.id`, NOT NULL | Owning user |
| `original_prompt` | `TEXT` | NOT NULL | Raw user input |
| `optimized_prompt` | `TEXT` | NULLABLE | Gemini's optimized output |
| `optimization_level` | `VARCHAR(20)` | NOT NULL | `concise` or `detailed` |
| `endpoint` | `VARCHAR(20)` | NOT NULL | `optimize` or `transform` |
| `platform` | `VARCHAR(50)` | NULLABLE | e.g., `chatgpt.com`, `claude.ai` |
| `was_accepted` | `BOOLEAN` | DEFAULT `FALSE` | Did user press Tab? |
| `response_time_ms` | `INTEGER` | NULLABLE | Backend round-trip time |
| `tokens_used` | `INTEGER` | NULLABLE | Gemini tokens consumed |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Timestamp |

**Indexes:**
- `idx_history_user_created` on `(user_id, created_at DESC)` — history feed
- `idx_history_platform` on `(platform)` — analytics by platform

#### `cache_entries`
Server-side prompt cache to avoid redundant Gemini calls.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Record ID |
| `prompt_hash` | `VARCHAR(64)` | UNIQUE, NOT NULL | SHA-256 of `(prompt + level)` |
| `level` | `VARCHAR(20)` | NOT NULL | `concise` or `detailed` |
| `optimized_text` | `TEXT` | NOT NULL | Cached Gemini response |
| `hit_count` | `INTEGER` | DEFAULT `0` | Number of cache hits |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Entry creation |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | TTL expiration (default: 24h) |

**Indexes:**
- `idx_cache_hash_level` on `(prompt_hash, level)` — lookup
- `idx_cache_expires` on `(expires_at)` — TTL cleanup

#### `usage_stats`
Daily aggregated usage counters per user for billing and analytics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Record ID |
| `user_id` | `UUID` | FK → `users.id`, NOT NULL | User |
| `date` | `DATE` | NOT NULL | Calendar date |
| `optimize_count` | `INTEGER` | DEFAULT `0` | `/optimize` calls |
| `transform_count` | `INTEGER` | DEFAULT `0` | `/transform` calls |
| `tokens_used` | `INTEGER` | DEFAULT `0` | Total Gemini tokens |
| `cached_hits` | `INTEGER` | DEFAULT `0` | Cache hit count |

**Constraints:**
- UNIQUE on `(user_id, date)` — one row per user per day

#### `error_log`
Server-side error telemetry for the self-annealing loop.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT `gen_random_uuid()` | Record ID |
| `user_id` | `UUID` | FK → `users.id`, NULLABLE | User (if authenticated) |
| `endpoint` | `VARCHAR(50)` | NOT NULL | Which route failed |
| `error_type` | `VARCHAR(100)` | NOT NULL | Error class/name |
| `error_message` | `TEXT` | NOT NULL | Error description |
| `stack_trace` | `TEXT` | NULLABLE | Full stack trace |
| `request_payload` | `JSONB` | NULLABLE | Sanitized request body |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `NOW()` | Timestamp |

---

## 4. Row-Level Security (RLS) Policy

All tables enforce Supabase RLS so users can only access their own data:

```
-- users: Users can only read/update their own row
CREATE POLICY "users_self" ON users
  FOR ALL USING (auth.uid() = id);

-- prompt_history: Users can only see their own history
CREATE POLICY "history_self" ON prompt_history
  FOR ALL USING (auth.uid() = user_id);

-- usage_stats: Users can only read their own stats
CREATE POLICY "stats_self" ON usage_stats
  FOR SELECT USING (auth.uid() = user_id);

-- cache_entries: Service role only (no direct user access)
-- error_log: Service role only
```

---

## 5. Data Retention & Cleanup Policy

| Table | Retention | Cleanup Method |
|---|---|---|
| `users` | Indefinite | Manual account deletion |
| `prompt_history` | 90 days (free), Indefinite (pro) | Scheduled Supabase Edge Function |
| `cache_entries` | 24 hours (via `expires_at`) | Scheduled cleanup query |
| `usage_stats` | 365 days | Annual archival |
| `error_log` | 30 days | Scheduled cleanup query |

---

## 6. Migration Strategy

### Phase 1 — Schema Bootstrap
1. Create Supabase project
2. Run initial migration SQL to create all tables, indexes, and RLS policies
3. Store Supabase URL and anon key in Vercel env vars

### Phase 2 — Cache Layer
1. Integrate `cache_entries` lookups before Gemini calls in `server.js`
2. Hash incoming prompts with SHA-256; check cache before calling Gemini
3. Write new Gemini responses to cache with 24h TTL

### Phase 3 — Auth Integration
1. Add Supabase Auth (email/password + Google OAuth)
2. Extension popup gains login/signup UI
3. Background service worker stores and forwards auth token

### Phase 4 — History & Analytics
1. Write to `prompt_history` on every API call
2. Increment `usage_stats` daily counters
3. Popup UI gains a "History" tab showing past prompts
4. Enforce `daily_limit` checks against `usage_stats`

---

## 7. Estimated Storage Projections

Assumptions: 1,000 active users, 20 prompts/day average, average prompt 200 chars.

| Table | Rows/Day | Row Size (avg) | Monthly Growth |
|---|---|---|---|
| `prompt_history` | 20,000 | ~500 bytes | ~300 MB |
| `cache_entries` | ~5,000 unique | ~400 bytes | ~60 MB (rolling) |
| `usage_stats` | 1,000 | ~100 bytes | ~3 MB |
| `error_log` | ~200 | ~800 bytes | ~5 MB |

**Total monthly growth:** ~368 MB — well within Supabase free tier (500 MB).

---

## 8. Cross-References

- **System Architecture →** `directives/01_system_architecture.md`
- **Service Architecture →** `directives/03_service_architecture.md`
- **Execution Script Plan →** `directives/04_execution_script_plan.md`
