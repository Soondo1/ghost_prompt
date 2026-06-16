# DIRECTIVE: Execution Script Plan — Prompt Ghost

> **PFA Layer:** 1 (Directive)
> **Status:** Draft — Pending Approval
> **Last Updated:** 2026-06-17

---

## 1. PFA Context

Per the PFA framework (§2, Layer 3), all deterministic, repeatable tasks must be encapsulated in atomic scripts within the `execution/` directory. The Layer 2 Orchestration Engine (this agent) calls these scripts with precise arguments, monitors their output, and applies the self-annealing loop on failure.

**Key PFA rules applied:**
- Scripts live in `execution/`
- Intermediate/volatile data goes to `.tmp/`
- Credentials stay in `.env` / Vercel env vars
- Agent audits `execution/` before creating any new script
- On failure: isolate → remediate → validate → update directives

---

## 2. Current State of `execution/`

The `execution/` directory **does not exist yet**. There are zero deterministic scripts. All operations (build, deploy, test) are currently manual or handled by npm scripts in `package.json`.

### Existing npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Start Vite dev server for popup |
| `build` | `vite build` | Build popup UI to `dist/popup/` |
| `server` | `node server/server.js` | Start local Express server |

---

## 3. Planned Script Inventory

Each script is a self-contained, well-commented file designed for the Orchestration Engine to invoke with explicit arguments.

### 3.1 Build & Deployment Scripts

| # | Script | Language | Purpose | Inputs | Outputs |
|---|---|---|---|---|---|
| E-01 | `execution/build_popup.py` | Python | Build the popup UI via Vite, validate output | None | `dist/popup/index.html` + assets |
| E-02 | `execution/validate_manifest.py` | Python | Lint `manifest.json` for MV3 compliance | `manifest.json` path | Pass/fail + error list |
| E-03 | `execution/package_extension.py` | Python | Zip extension files into `.crx`-ready package | Output path | `.tmp/prompt-ghost-v{version}.zip` |
| E-04 | `execution/deploy_vercel.py` | Python | Deploy server to Vercel via CLI, verify health | Environment flag | Deployment URL + health check result |

### 3.2 Database & Migration Scripts

| # | Script | Language | Purpose | Inputs | Outputs |
|---|---|---|---|---|---|
| E-05 | `execution/db_migrate.py` | Python | Run SQL migrations against Supabase | Migration file path | Migration status log |
| E-06 | `execution/db_seed.py` | Python | Seed development database with test data | Seed config | Row count summary |
| E-07 | `execution/db_cleanup.py` | Python | Purge expired cache entries and old error logs | Retention days | Deleted row counts |

### 3.3 Testing Scripts

| # | Script | Language | Purpose | Inputs | Outputs |
|---|---|---|---|---|---|
| E-08 | `execution/test_api_endpoints.py` | Python | Hit `/optimize` and `/transform` with test prompts, validate responses | API base URL | Pass/fail per endpoint |
| E-09 | `execution/test_cache_layer.py` | Python | Verify cache writes, cache hits, and TTL expiration | API base URL | Cache hit rate, timing |
| E-10 | `execution/test_rate_limiter.py` | Python | Send burst requests, verify 429 responses after limit | API base URL, burst count | Pass/fail + response codes |
| E-11 | `execution/test_auth_flow.py` | Python | Test signup → login → authenticated request → token refresh | API base URL | Pass/fail per step |

### 3.4 Monitoring & Analytics Scripts

| # | Script | Language | Purpose | Inputs | Outputs |
|---|---|---|---|---|---|
| E-12 | `execution/health_check.py` | Python | Ping all endpoints, verify Gemini connectivity | None | Status dashboard JSON |
| E-13 | `execution/usage_report.py` | Python | Query `usage_stats` and generate daily/weekly report | Date range | `.tmp/usage_report_{date}.json` |
| E-14 | `execution/error_analysis.py` | Python | Aggregate `error_log` entries, identify top failure modes | Date range | `.tmp/error_report_{date}.json` |

### 3.5 Security Scripts

| # | Script | Language | Purpose | Inputs | Outputs |
|---|---|---|---|---|---|
| E-15 | `execution/rotate_api_key.py` | Python | Rotate Gemini API key: generate new, update Vercel env, invalidate old | None | Confirmation + new key hash |
| E-16 | `execution/audit_env_security.py` | Python | Scan git history for leaked secrets, check `.env` patterns | Repo path | Risk report |

---

## 4. Script Design Standards

Every script in `execution/` must follow these conventions:

### 4.1 Header Template

```python
"""
execution/{script_name}.py
PFA Layer 3 — Deterministic Execution Script

Purpose: {one-line description}
Inputs:  {CLI args or environment variables}
Outputs: {files created, stdout, exit codes}
Author:  Orchestration Engine
Created: {date}
Updated: {date}
"""
```

### 4.2 Required Patterns

| Pattern | Requirement |
|---|---|
| **Argument parsing** | Use `argparse` with `--help` support |
| **Logging** | Use `logging` module, write to stdout + `.tmp/logs/{script}_{timestamp}.log` |
| **Exit codes** | `0` = success, `1` = handled error, `2` = unhandled/fatal |
| **Environment** | Load from `.env` via `python-dotenv`; never hardcode secrets |
| **Error handling** | Wrap main logic in `try/except`, log full traceback on failure |
| **Idempotency** | Scripts must be safe to re-run without side effects |
| **Timeouts** | All HTTP calls must have explicit timeout (default: 10s) |

### 4.3 Dependency Management

```
execution/requirements.txt
├── requests>=2.31.0
├── python-dotenv>=1.0.0
├── supabase>=2.0.0        (for DB scripts)
├── google-generativeai     (for Gemini test scripts)
└── pytest>=7.0.0           (for test runner)
```

---

## 5. Directory Structure (Target)

```
execution/
├── requirements.txt          # Python dependencies
├── build_popup.py            # E-01
├── validate_manifest.py      # E-02
├── package_extension.py      # E-03
├── deploy_vercel.py          # E-04
├── db_migrate.py             # E-05
├── db_seed.py                # E-06
├── db_cleanup.py             # E-07
├── test_api_endpoints.py     # E-08
├── test_cache_layer.py       # E-09
├── test_rate_limiter.py      # E-10
├── test_auth_flow.py         # E-11
├── health_check.py           # E-12
├── usage_report.py           # E-13
├── error_analysis.py         # E-14
├── rotate_api_key.py         # E-15
├── audit_env_security.py     # E-16
└── migrations/
    ├── 001_create_users.sql
    ├── 002_create_prompt_history.sql
    ├── 003_create_cache_entries.sql
    ├── 004_create_usage_stats.sql
    ├── 005_create_error_log.sql
    └── 006_add_rls_policies.sql

.tmp/                          # Volatile data (gitignored)
├── logs/
│   └── {script}_{timestamp}.log
├── usage_report_{date}.json
├── error_report_{date}.json
└── prompt-ghost-v{version}.zip
```

---

## 6. Execution Sequence by Phase

### Phase 1 — Fix & Stabilize (Week 1)

```
1. Agent audits execution/ (empty) → creates directory
2. E-16: audit_env_security.py   → identify leaked API key in git history
3. E-15: rotate_api_key.py       → rotate compromised key
4. E-02: validate_manifest.py    → lint manifest.json
5. E-01: build_popup.py          → fix CSS import, rebuild popup
6. E-08: test_api_endpoints.py   → verify /optimize and /transform work
```

### Phase 2 — Database & Cache (Week 2)

```
1. E-05: db_migrate.py (001–006) → create all tables + RLS
2. E-06: db_seed.py              → seed test users + prompts
3. E-09: test_cache_layer.py     → verify cache write/read/TTL
4. E-08: test_api_endpoints.py   → re-verify with cache layer active
```

### Phase 3 — Auth & Security (Week 3)

```
1. E-05: db_migrate.py (if new)  → any auth-related schema changes
2. E-11: test_auth_flow.py       → verify signup/login/token lifecycle
3. E-10: test_rate_limiter.py    → verify 429 after burst
4. E-12: health_check.py         → full system health verification
```

### Phase 4 — Polish & Ship (Week 4)

```
1. E-03: package_extension.py   → create .zip for Chrome Web Store
2. E-04: deploy_vercel.py       → deploy final server build
3. E-13: usage_report.py        → generate baseline usage report
4. E-14: error_analysis.py      → verify zero critical errors
5. E-12: health_check.py        → final health verification
```

---

## 7. Self-Annealing Loop Integration

When any `execution/` script returns exit code `1` or `2`, the Orchestration Engine:

1. **Reads** the script's log file from `.tmp/logs/`
2. **Isolates** the root cause from the error output
3. **Modifies** the failing script to address the issue (e.g., add retry logic, fix parsing)
4. **Re-runs** the modified script to validate the fix
5. **Updates** the relevant directive in `directives/` with the new operational knowledge

This cycle continues until the script returns exit code `0` or the agent escalates to the user.

---

## 8. Cross-References

- **System Architecture →** `directives/01_system_architecture.md`
- **Database Architecture →** `directives/02_database_architecture.md`
- **Service Architecture →** `directives/03_service_architecture.md`
- **Risk Analysis →** `directives/05_risk_analysis.md`
- **Implementation Roadmap →** `directives/06_implementation_roadmap.md`
