# PROJECT MASTER PLAN — Prompt Ghost 👻

> **PFA Role:** Layer 2 Orchestration Engine
> **Status:** AWAITING APPROVAL — No code will be generated until explicit authorization.
> **Last Updated:** 2026-06-17

---

## Directive Index

All planning documents live in `directives/` as PFA Layer 1 assets:

| # | Document | Purpose | Status |
|---|---|---|---|
| 01 | [System Architecture](01_system_architecture.md) | Full 3-layer topology, component inventory, as-is vs. to-be architecture, 12 identified gaps | ✅ Draft |
| 02 | [Database Architecture](02_database_architecture.md) | Supabase PostgreSQL schema (5 tables), RLS policies, migration strategy, storage projections | ✅ Draft |
| 03 | [Service Architecture](03_service_architecture.md) | 6 API contracts, middleware pipeline, Chrome message protocol, error handling strategy, perf targets | ✅ Draft |
| 04 | [Execution Script Plan](04_execution_script_plan.md) | 16 PFA Layer 3 Python scripts for build, deploy, test, DB, monitoring, security | ✅ Draft |
| 05 | [Risk Analysis](05_risk_analysis.md) | 14 risks scored by likelihood × impact, prioritized mitigation queue | ✅ Draft |
| 06 | [Implementation Roadmap](06_implementation_roadmap.md) | 4-week day-by-day plan with exit criteria, milestones, resource requirements | ✅ Draft |

---

## Critical Findings from Audit

### 🔴 Immediate Threats (Act Before Week 1 Ends)

1. **API key is exposed in git history** — `.env` containing `GEMINI_API_KEY` was committed. Must rotate immediately.
2. **API is completely unauthenticated** — Anyone can call `/optimize` and `/transform` on the public Vercel URL.
3. **Build is broken** — `App.jsx` CSS import path error prevents popup compilation.

### 🟠 Structural Gaps

4. Zero database — no persistence, history, or analytics
5. Zero test coverage — no automated testing of any kind
6. Zero caching — every identical prompt re-calls Gemini
7. Zero error telemetry — production errors are invisible
8. Zero rate limiting — unlimited API abuse possible

### 🟢 What's Working

- Content script correctly detects and overlays on 10 AI platforms
- Background service worker relays messages properly
- Vercel serverless deployment is functional
- Gemini integration returns valid optimized prompts
- Existing `dist/popup/` (stale) functions in Chrome

---

## Awaiting Your Approval

All six directives are ready for review. **No code will be written until you explicitly approve.**

To proceed, please review the directives and confirm:
1. ✅ or ❌ on the overall approach
2. Any changes to scope, priorities, or technology choices (e.g., Supabase vs. Firebase)
3. Which phase to begin with (recommended: Week 1 — Stabilize)
