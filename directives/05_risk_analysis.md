# DIRECTIVE: Risk Analysis — Prompt Ghost

> **PFA Layer:** 1 (Directive)
> **Status:** Draft — Pending Approval
> **Last Updated:** 2026-06-17

---

## 1. Risk Assessment Methodology

Each risk is evaluated on two axes:

- **Likelihood:** Low (unlikely), Medium (possible), High (probable)
- **Impact:** Low (cosmetic), Medium (degraded functionality), High (service outage or data breach), Critical (financial loss or security compromise)

**Risk Score Matrix:**

|  | Low Impact | Medium Impact | High Impact | Critical Impact |
|---|---|---|---|---|
| **High Likelihood** | Medium | High | Critical | Critical |
| **Medium Likelihood** | Low | Medium | High | Critical |
| **Low Likelihood** | Low | Low | Medium | High |

---

## 2. Critical Risks (Immediate Action Required)

### R-01: API Key Exposed in Git History

| Attribute | Detail |
|---|---|
| **Category** | Security |
| **Likelihood** | High — Key is committed in `.env` and visible in `git log` |
| **Impact** | Critical — Anyone with repo access can steal the Gemini API key |
| **Current Mitigation** | `.gitignore` prevents future commits, but history is contaminated |
| **Required Mitigation** | 1. Immediately rotate the Gemini API key via Google AI Studio. 2. Set new key exclusively in Vercel environment variables. 3. Run `execution/audit_env_security.py` to scan for other leaks. 4. Consider `git filter-branch` or BFG Repo Cleaner to purge history. |
| **Owner** | Phase 1, Week 1 |
| **PFA Script** | `E-15: rotate_api_key.py`, `E-16: audit_env_security.py` |

### R-02: Unauthenticated Public API

| Attribute | Detail |
|---|---|
| **Category** | Security / Financial |
| **Likelihood** | High — Endpoints are publicly reachable with zero auth |
| **Impact** | Critical — Any HTTP client can call `/optimize` and `/transform`, consuming Gemini API credits indefinitely |
| **Current Mitigation** | None |
| **Required Mitigation** | 1. Add authentication middleware (Supabase JWT). 2. Enforce rate limiting per user. 3. Add server-side request logging for abuse detection. |
| **Owner** | Phase 3, Week 3 |
| **PFA Script** | `E-11: test_auth_flow.py`, `E-10: test_rate_limiter.py` |

---

## 3. High Risks

### R-03: Build Pipeline Broken

| Attribute | Detail |
|---|---|
| **Category** | Engineering |
| **Likelihood** | High — Currently failing (see `build_error.log`) |
| **Impact** | High — Cannot produce fresh popup builds; stuck on stale `dist/` |
| **Root Cause** | `App.jsx` imports `./index.css` but Vite resolves from wrong path. The CSS file exists at `popup/src/index.css` but the import resolves relative to the component. |
| **Required Mitigation** | Fix the import path in `App.jsx` or adjust Vite alias config. Validate with `E-01: build_popup.py`. |
| **Owner** | Phase 1, Week 1 |

### R-04: No Rate Limiting

| Attribute | Detail |
|---|---|
| **Category** | Financial / Availability |
| **Likelihood** | Medium — Depends on discovery by malicious actors |
| **Impact** | High — Uncapped Gemini API costs; potential service degradation |
| **Current Mitigation** | Client-side debounce (800ms) only |
| **Required Mitigation** | Server-side rate limiter: 50 calls/day (free tier), 500 calls/day (pro). Check against `usage_stats` table. |
| **Owner** | Phase 3, Week 3 |

### R-05: No Test Coverage

| Attribute | Detail |
|---|---|
| **Category** | Engineering |
| **Likelihood** | High — Zero tests exist |
| **Impact** | High — Regressions introduced silently; no confidence in deployments |
| **Required Mitigation** | Build test scripts (`E-08` through `E-11`) covering API endpoints, cache, rate limiting, and auth flows. |
| **Owner** | Phases 2–3, Weeks 2–3 |

### R-06: Single Model Dependency (Gemini 2.5 Flash)

| Attribute | Detail |
|---|---|
| **Category** | Availability |
| **Likelihood** | Medium — Google API outages are infrequent but documented |
| **Impact** | High — Total service failure if Gemini is unavailable |
| **Current Mitigation** | None — hardcoded to `gemini-2.5-flash` |
| **Required Mitigation** | Abstract model calls behind a provider interface. Add fallback to a secondary model (e.g., Gemini 2.0 Flash) or return a graceful degradation message. |
| **Owner** | Phase 4, Week 4 (stretch goal) |

---

## 4. Medium Risks

### R-07: No Prompt Caching

| Attribute | Detail |
|---|---|
| **Category** | Financial / Performance |
| **Likelihood** | High — Every request calls Gemini, even for identical prompts |
| **Impact** | Medium — Unnecessary API costs and latency |
| **Required Mitigation** | SHA-256 hash of `(prompt + level)` → check `cache_entries` before calling Gemini. 24h TTL. |
| **Owner** | Phase 2, Week 2 |

### R-08: No Error Telemetry

| Attribute | Detail |
|---|---|
| **Category** | Operations |
| **Likelihood** | High — Errors only go to `console.error` |
| **Impact** | Medium — No visibility into production failures; self-annealing loop cannot operate |
| **Required Mitigation** | Log all server errors to `error_log` table. Build `E-14: error_analysis.py` for aggregated reports. |
| **Owner** | Phase 2, Week 2 |

### R-09: Vercel Cold Start Latency

| Attribute | Detail |
|---|---|
| **Category** | Performance |
| **Likelihood** | Medium — Vercel serverless functions have cold starts |
| **Impact** | Medium — First request after idle may take 2–5 seconds |
| **Required Mitigation** | 1. Keep function warm with `E-12: health_check.py` on a cron schedule. 2. Client-side timeout handling (show loading state, retry once). |
| **Owner** | Phase 4, Week 4 |

### R-10: Content Script Breakage on Site Updates

| Attribute | Detail |
|---|---|
| **Category** | Compatibility |
| **Likelihood** | Medium — AI chat sites update their DOM frequently |
| **Impact** | Medium — Ghost overlay may misalign or fail to detect input fields |
| **Current Mitigation** | Generic selectors (`TEXTAREA`, `isContentEditable`) are resilient |
| **Required Mitigation** | Monitor for breakage via user reports or automated DOM structure checks. Use `MutationObserver` to re-detect inputs dynamically (partially implemented). |
| **Owner** | Ongoing |

### R-11: Chrome Web Store Review Rejection

| Attribute | Detail |
|---|---|
| **Category** | Distribution |
| **Likelihood** | Medium — CWS reviews are strict on permissions and host_permissions |
| **Impact** | Medium — Cannot distribute via official channel |
| **Required Mitigation** | 1. Justify each `host_permission` in store listing description. 2. Add privacy policy explaining data handling. 3. Minimize permissions to only what's needed. 4. Test with Chrome Extension Lint tools. |
| **Owner** | Phase 4, Week 4 |

---

## 5. Low Risks

### R-12: Missing Extension Icon

| Attribute | Detail |
|---|---|
| **Category** | UX |
| **Likelihood** | High — No icon files exist |
| **Impact** | Low — Default puzzle-piece icon shown; unprofessional appearance |
| **Required Mitigation** | Design and add 16px, 32px, 48px, 128px icon PNGs. Update `manifest.json` with `default_icon`. |
| **Owner** | Phase 4, Week 4 |

### R-13: Deprecated Vite CJS API Warning

| Attribute | Detail |
|---|---|
| **Category** | Engineering |
| **Likelihood** | High — Warning appears on every build |
| **Impact** | Low — Functional now, but CJS support will be removed in Vite 6 |
| **Required Mitigation** | Migrate `vite.config.js` to ESM format. Update `package.json` with `"type": "module"` or use `.mjs` extension. |
| **Owner** | Phase 1, Week 1 (minor) |

### R-14: `document.execCommand('insertText')` Deprecation

| Attribute | Detail |
|---|---|
| **Category** | Compatibility |
| **Likelihood** | Low — Chrome still supports it; no removal timeline |
| **Impact** | Medium — Would break contenteditable suggestion insertion if removed |
| **Required Mitigation** | Monitor Chrome deprecation notices. Prepare fallback using `InputEvent` constructor or `DataTransfer` approach. |
| **Owner** | Ongoing monitoring |

---

## 6. Risk Register Summary

| ID | Risk | Likelihood | Impact | Score | Phase |
|---|---|---|---|---|---|
| R-01 | API key in git history | High | Critical | **CRITICAL** | Week 1 |
| R-02 | Unauthenticated API | High | Critical | **CRITICAL** | Week 3 |
| R-03 | Broken build pipeline | High | High | **CRITICAL** | Week 1 |
| R-04 | No rate limiting | Medium | High | **HIGH** | Week 3 |
| R-05 | No test coverage | High | High | **CRITICAL** | Weeks 2–3 |
| R-06 | Single model dependency | Medium | High | **HIGH** | Week 4 |
| R-07 | No prompt caching | High | Medium | **HIGH** | Week 2 |
| R-08 | No error telemetry | High | Medium | **HIGH** | Week 2 |
| R-09 | Vercel cold start | Medium | Medium | **MEDIUM** | Week 4 |
| R-10 | Content script breakage | Medium | Medium | **MEDIUM** | Ongoing |
| R-11 | CWS review rejection | Medium | Medium | **MEDIUM** | Week 4 |
| R-12 | Missing extension icon | High | Low | **MEDIUM** | Week 4 |
| R-13 | Vite CJS deprecation | High | Low | **MEDIUM** | Week 1 |
| R-14 | execCommand deprecation | Low | Medium | **LOW** | Ongoing |

---

## 7. Risk Mitigation Priority Queue

Ordered by risk score, then by effort (lowest first):

1. 🔴 **R-01** — Rotate API key immediately (30 min)
2. 🔴 **R-03** — Fix build pipeline (15 min)
3. 🔴 **R-05** — Create test scripts (Week 2–3)
4. 🔴 **R-02** — Add authentication (Week 3)
5. 🟠 **R-04** — Add rate limiting (Week 3, with auth)
6. 🟠 **R-07** — Add prompt caching (Week 2)
7. 🟠 **R-08** — Add error telemetry (Week 2)
8. 🟠 **R-06** — Abstract model provider (Week 4)
9. 🟡 **R-09** — Warm function with health check cron (Week 4)
10. 🟡 **R-10** — Monitor content script compatibility (ongoing)
11. 🟡 **R-11** — Prepare CWS submission (Week 4)
12. 🟡 **R-12** — Design extension icon (Week 4)
13. 🟡 **R-13** — Fix Vite CJS warning (Week 1)
14. 🟢 **R-14** — Monitor execCommand deprecation (ongoing)

---

## 8. Cross-References

- **System Architecture →** `directives/01_system_architecture.md`
- **Database Architecture →** `directives/02_database_architecture.md`
- **Service Architecture →** `directives/03_service_architecture.md`
- **Execution Script Plan →** `directives/04_execution_script_plan.md`
- **Implementation Roadmap →** `directives/06_implementation_roadmap.md`
