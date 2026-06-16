# DIRECTIVE: 4-Week Implementation Roadmap — Prompt Ghost

> **PFA Layer:** 1 (Directive)
> **Status:** Draft — Pending Approval
> **Last Updated:** 2026-06-17
> **Start Date:** Upon approval

---

## Roadmap Overview

```
Week 1                Week 2                Week 3                Week 4
STABILIZE             DATABASE & CACHE      AUTH & SECURITY       POLISH & SHIP
──────────────────    ──────────────────    ──────────────────    ──────────────────
▪ Fix broken build    ▪ Supabase setup      ▪ Auth middleware      ▪ Extension icon
▪ Rotate API key      ▪ Schema migration    ▪ Auth UI (popup)      ▪ CWS prep
▪ Security audit      ▪ Cache layer         ▪ Rate limiting        ▪ Model abstraction
▪ PFA scaffolding     ▪ Error telemetry     ▪ History feature      ▪ Final deploy
▪ Manifest fixes      ▪ API tests           ▪ Auth+rate tests      ▪ Health monitoring
──────────────────    ──────────────────    ──────────────────    ──────────────────
EXIT: Builds clean    EXIT: Cache active    EXIT: Auth enforced    EXIT: Store-ready
       Key rotated           Tests pass            Rate limited           All tests pass
```

---

## Week 1: Stabilize & Secure Foundation

**Theme:** Fix what's broken, close critical security gaps, scaffold PFA infrastructure.

### Day 1–2: Critical Security

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 1.1 | Rotate compromised Gemini API key | R-01 | New key in Vercel env vars, old key invalidated | `E-15` |
| 1.2 | Audit git history for leaked secrets | R-01 | Security audit report in `.tmp/` | `E-16` |
| 1.3 | Update `.env` handling — ensure `.env` never reaches remote | R-01 | Verified `.gitignore`, purged history if needed | Manual |

### Day 2–3: Fix Build Pipeline

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 1.4 | Fix CSS import path in `popup/src/App.jsx` | R-03 | `npm run build` succeeds cleanly | `E-01` |
| 1.5 | Resolve Vite CJS deprecation warning | R-13 | Clean build output, no warnings | `E-01` |
| 1.6 | Validate `manifest.json` for MV3 compliance | — | Manifest lint report | `E-02` |
| 1.7 | Verify extension loads in Chrome after rebuild | R-03 | Extension functional in dev mode | Manual |

### Day 4–5: PFA Infrastructure Scaffolding

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 1.8 | Create `execution/` directory structure | — | All script stubs + `requirements.txt` | — |
| 1.9 | Create `.tmp/` directory with `.gitignore` | — | Volatile storage ready | — |
| 1.10 | Build `E-01: build_popup.py` | — | Automated build script | `E-01` |
| 1.11 | Build `E-02: validate_manifest.py` | — | Automated manifest linter | `E-02` |
| 1.12 | Build `E-08: test_api_endpoints.py` | R-05 | API endpoint smoke tests | `E-08` |
| 1.13 | Run `E-08` against live Vercel deployment | R-05 | Test results in `.tmp/logs/` | `E-08` |

### Week 1 Exit Criteria

- [ ] Build pipeline produces clean `dist/popup/` output
- [ ] Gemini API key rotated and secured
- [ ] Extension loads and functions in Chrome
- [ ] `execution/` scaffolded with 3 working scripts
- [ ] API endpoints verified via `E-08`

---

## Week 2: Database & Cache Layer

**Theme:** Introduce persistence, caching, and error telemetry — the backbone for all future features.

### Day 1–2: Supabase Setup & Migration

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 2.1 | Create Supabase project (free tier) | — | Project URL + anon key | Manual |
| 2.2 | Write SQL migrations (001–006) | — | Migration files in `execution/migrations/` | — |
| 2.3 | Build `E-05: db_migrate.py` | — | Migration runner script | `E-05` |
| 2.4 | Execute migrations against Supabase | — | All tables + indexes + RLS policies created | `E-05` |
| 2.5 | Build `E-06: db_seed.py` | — | Dev seed data script | `E-06` |
| 2.6 | Seed development database | — | Test users + sample prompts | `E-06` |
| 2.7 | Store Supabase credentials in Vercel env vars | — | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | Manual |

### Day 3–4: Cache Layer Integration

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 2.8 | Add SHA-256 prompt hashing to `server.js` | R-07 | Hash function in server | — |
| 2.9 | Add cache-check-before-Gemini logic in `/optimize` | R-07 | Cache lookup + write-through | — |
| 2.10 | Add cache-check-before-Gemini logic in `/transform` | R-07 | Same for transform endpoint | — |
| 2.11 | Build `E-09: test_cache_layer.py` | R-05 | Cache test script | `E-09` |
| 2.12 | Verify cache hits, misses, and TTL expiration | R-07 | Test pass report | `E-09` |
| 2.13 | Build `E-07: db_cleanup.py` | — | Expired cache cleanup script | `E-07` |

### Day 5: Error Telemetry

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 2.14 | Add error logging middleware to `server.js` | R-08 | Errors written to `error_log` table | — |
| 2.15 | Add usage tracking middleware (increment `usage_stats`) | R-08 | Daily counters updated per request | — |
| 2.16 | Build `E-14: error_analysis.py` | R-08 | Error aggregation report script | `E-14` |
| 2.17 | Build `E-13: usage_report.py` | — | Usage report generator | `E-13` |
| 2.18 | Deploy updated server to Vercel | — | Live deployment with cache + telemetry | `E-04` |

### Week 2 Exit Criteria

- [ ] Supabase project live with all 5 tables + RLS
- [ ] Cache layer active — duplicate prompts served from DB
- [ ] Error telemetry writing to `error_log`
- [ ] Usage stats incrementing per request
- [ ] `E-09` cache tests passing
- [ ] `E-13` and `E-14` producing valid reports

---

## Week 3: Authentication & Rate Limiting

**Theme:** Secure the API, gate access, and unlock user-scoped features (history, usage limits).

### Day 1–2: Server-Side Auth

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 3.1 | Integrate Supabase Auth SDK into `server.js` | R-02 | Auth middleware validates JWT on protected routes | — |
| 3.2 | Create `POST /auth/signup` endpoint | R-02 | User registration with email/password | — |
| 3.3 | Create `POST /auth/login` endpoint | R-02 | Returns access + refresh tokens | — |
| 3.4 | Protect `/optimize` and `/transform` with auth middleware | R-02 | 401 for unauthenticated calls | — |
| 3.5 | Build `E-11: test_auth_flow.py` | R-05 | Full auth lifecycle test | `E-11` |
| 3.6 | Verify auth flow end-to-end | R-02 | `E-11` passes | `E-11` |

### Day 3: Rate Limiting

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 3.7 | Add rate limit middleware (check `usage_stats` vs `daily_limit`) | R-04 | 429 returned when limit exceeded | — |
| 3.8 | Build `E-10: test_rate_limiter.py` | R-05 | Rate limiter verification script | `E-10` |
| 3.9 | Verify rate limiter with burst test | R-04 | `E-10` passes | `E-10` |

### Day 4–5: Extension Auth UI & History

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 3.10 | Add login/signup views to popup `App.jsx` | R-02 | Auth UI in popup | — |
| 3.11 | Update background worker to manage auth tokens | R-02 | Token stored in `chrome.storage.local` | — |
| 3.12 | Create `GET /history` endpoint | — | Paginated prompt history API | — |
| 3.13 | Create `GET /usage` endpoint | — | Daily usage stats API | — |
| 3.14 | Add History tab to popup UI | — | Users can browse past prompts | — |
| 3.15 | Add acceptance tracking — report Tab-accept to server | — | `was_accepted` flag set correctly | — |
| 3.16 | Deploy updated server + rebuilt extension | — | Live with auth + history | `E-04`, `E-01` |

### Week 3 Exit Criteria

- [ ] All API endpoints require authentication
- [ ] Rate limiting enforced (50 calls/day free tier)
- [ ] Popup UI has login/signup flow
- [ ] History tab shows past prompts
- [ ] `E-10` and `E-11` tests passing
- [ ] Server deployed with auth + rate limiting active

---

## Week 4: Polish, Package & Ship

**Theme:** Production-harden the system, create branding assets, prepare for Chrome Web Store submission.

### Day 1–2: Extension Polish

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 4.1 | Design extension icon (16px, 32px, 48px, 128px) | R-12 | Icon PNGs in `assets/` | — |
| 4.2 | Update `manifest.json` with `default_icon` | R-12 | Icons display in toolbar | `E-02` |
| 4.3 | Add privacy policy document | R-11 | `PRIVACY.md` in repo root | — |
| 4.4 | Write Chrome Web Store listing description | R-11 | CWS description document | — |
| 4.5 | Abstract Gemini calls behind provider interface | R-06 | Model switching capability | — |

### Day 3–4: System Hardening

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 4.6 | Build `E-12: health_check.py` | R-09 | System health verification | `E-12` |
| 4.7 | Set up health check on cron (keep Vercel warm) | R-09 | Scheduled health pings | `E-12` |
| 4.8 | Run full test suite: `E-08` through `E-11` | R-05 | All tests green | All test scripts |
| 4.9 | Build `E-03: package_extension.py` | R-11 | Extension packager | `E-03` |
| 4.10 | Package extension as `.zip` | R-11 | `.tmp/prompt-ghost-v1.0.0.zip` | `E-03` |

### Day 5: Final Deployment & Verification

| # | Task | Risk | Deliverable | Script |
|---|---|---|---|---|
| 4.11 | Build `E-04: deploy_vercel.py` | — | Automated deployment script | `E-04` |
| 4.12 | Deploy final server build to Vercel | — | Production deployment live | `E-04` |
| 4.13 | Run `E-12: health_check.py` against production | — | All systems green | `E-12` |
| 4.14 | Generate baseline usage report | — | `.tmp/usage_report_{date}.json` | `E-13` |
| 4.15 | Generate error analysis report (expect zero criticals) | — | `.tmp/error_report_{date}.json` | `E-14` |
| 4.16 | Update all directives with final operational learnings | — | Directives reflect production state | — |

### Week 4 Exit Criteria

- [ ] Extension has proper branding icons
- [ ] Privacy policy written
- [ ] Model provider abstraction in place
- [ ] All 11 test scripts (`E-08` through `E-16` applicable) passing
- [ ] Extension packaged as `.zip` ready for CWS submission
- [ ] Final Vercel deployment live and health-checked
- [ ] All directives updated with operational learnings

---

## Milestone Summary

| Milestone | Week | Key Outcome | Risk Coverage |
|---|---|---|---|
| **M1: Stable Foundation** | 1 | Clean builds, rotated key, PFA scaffolded | R-01, R-03, R-13 |
| **M2: Persistent Backend** | 2 | Database live, caching active, telemetry flowing | R-07, R-08, R-05 |
| **M3: Secured System** | 3 | Auth enforced, rate limited, history feature live | R-02, R-04, R-05 |
| **M4: Production Ready** | 4 | Polished, tested, packaged for Chrome Web Store | R-06, R-09, R-11, R-12 |

---

## Resource Requirements

| Resource | Requirement | Cost |
|---|---|---|
| Supabase (free tier) | 500MB database, 50K auth users | $0 |
| Vercel (Hobby) | Serverless functions, edge CDN | $0 |
| Google Gemini API | API key with usage tracking | Pay-per-use (~$0.01/1K requests) |
| Python 3.11+ | For `execution/` scripts | $0 |
| Node.js 18+ | For build pipeline | $0 |
| Chrome Developer Account | For CWS submission | $5 one-time |

---

## Dependencies & Blockers

| Dependency | Blocker For | Resolution |
|---|---|---|
| User approval of these directives | All execution | Awaiting review |
| Supabase project creation | Week 2 tasks | Requires account signup |
| Chrome Developer account | CWS submission (Week 4) | Requires $5 registration |
| Gemini API quota | All optimization calls | Monitor usage vs. free tier limits |

---

## Cross-References

- **System Architecture →** `directives/01_system_architecture.md`
- **Database Architecture →** `directives/02_database_architecture.md`
- **Service Architecture →** `directives/03_service_architecture.md`
- **Execution Script Plan →** `directives/04_execution_script_plan.md`
- **Risk Analysis →** `directives/05_risk_analysis.md`
