# DIRECTIVE: System Architecture — Prompt Ghost

> **PFA Layer:** 1 (Directive)
> **Status:** Draft — Pending Approval
> **Last Updated:** 2026-06-17

---

## 1. System Overview

Prompt Ghost is a Chrome Extension + Serverless Backend system that provides real-time AI-powered prompt optimization directly inside LLM chat interfaces. The system follows a client-heavy architecture where the browser extension handles all user interaction, and a lightweight serverless API mediates calls to Google's Gemini 2.5 Flash model.

---

## 2. Three-Layer PFA Mapping

| PFA Layer | Prompt Ghost Component | Location |
|---|---|---|
| **Layer 1 — Directives** | Architecture docs, SOPs, roadmaps | `directives/` |
| **Layer 2 — Orchestration** | AI agent (this engine) — plans, sequences, error recovery | Agent runtime |
| **Layer 3 — Execution** | Deterministic scripts (build, deploy, test, migrate) | `execution/` *(to be created)* |

---

## 3. Current Architecture (As-Is)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT: Chrome Extension                      │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────────────────────────┐ │
│  │  POPUP UI        │   │  CONTENT SCRIPT                      │ │
│  │  React 18 + TW   │   │  Vanilla JS IIFE                    │ │
│  │  Vite-built       │   │  Injected at document_idle           │ │
│  │                   │   │                                      │ │
│  │  • Manual input   │   │  • Textarea/contenteditable detect  │ │
│  │  • 2 variations   │   │  • 800ms debounce → fetch           │ │
│  │  • Copy-to-clip   │   │  • Ghost overlay rendering          │ │
│  │  • Settings UI    │   │  • Tab-to-accept / key-to-dismiss   │ │
│  └──────┬────────────┘   └───────────┬────────────────────────┘ │
│         │                            │                           │
│         │  chrome.runtime.sendMessage │                           │
│         └──────────┬─────────────────┘                           │
│               ┌────▼─────────────────┐                           │
│               │  BACKGROUND SERVICE  │                           │
│               │  WORKER (MV3)        │                           │
│               │                      │                           │
│               │  • Message router    │                           │
│               │  • fetch() relay     │                           │
│               └────┬─────────────────┘                           │
└────────────────────┼─────────────────────────────────────────────┘
                     │  HTTPS POST (JSON)
                     ▼
┌────────────────────────────────────────┐
│  SERVER: Vercel Serverless Function    │
│  (Express.js / @vercel/node)           │
│                                        │
│  POST /optimize                        │
│    → Gemini 2.5 Flash → single prompt  │
│                                        │
│  POST /transform                       │
│    → Gemini 2.5 Flash → 2 variations   │
│                                        │
│  Auth: GEMINI_API_KEY (env var)        │
└────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────┐
│  EXTERNAL: Google Gemini 2.5 Flash    │
│  via @google/generative-ai SDK         │
└────────────────────────────────────────┘
```

---

## 4. Component Inventory

### 4.1 Chrome Extension (Client)

| File | Role | Lines | Status |
|---|---|---|---|
| `manifest.json` | MV3 manifest — permissions, content scripts, service worker, popup | 48 | ✅ Functional |
| `src/content.js` | Content script — ghost overlay, input detection, Tab accept | 212 | ✅ Functional |
| `src/background.js` | Service worker — message relay to API | 40 | ✅ Functional |
| `popup/index.html` | Popup HTML shell | 13 | ✅ Functional |
| `popup/src/index.jsx` | React entry point | 12 | ✅ Functional |
| `popup/src/App.jsx` | Popup UI — transform, settings, copy | 140 | ✅ Functional |
| `popup/src/index.css` | Tailwind directives | 4 | ✅ Functional |

### 4.2 Backend API (Server)

| File | Role | Lines | Status |
|---|---|---|---|
| `server/server.js` | Express API with `/optimize` and `/transform` endpoints | 73 | ✅ Functional |
| `vercel.json` | Vercel deployment routing config | 16 | ✅ Functional |
| `.env` | `GEMINI_API_KEY` storage | 2 | ⚠️ Contains live key |

### 4.3 Build & Config

| File | Role | Status |
|---|---|---|
| `package.json` | Dependencies & npm scripts | ✅ Functional |
| `vite.config.js` | Vite build for popup (root: `popup/`, out: `dist/popup/`) | ✅ Functional |
| `tailwind.config.js` | Tailwind content paths | ✅ Functional |
| `postcss.config.js` | PostCSS plugin chain | ✅ Functional |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `.env`, `build_error.log` | ✅ Functional |

---

## 5. Data Flow Topology

### 5.1 Live Ghost Overlay Flow

```
User types in ChatGPT textarea
        │
        ▼
content.js: input event (800ms debounce)
        │
        ▼
chrome.runtime.sendMessage({ action: 'fetchSuggestion', prompt, level })
        │
        ▼
background.js: fetch('https://ghost-prompt.vercel.app/optimize', POST)
        │
        ▼
server.js: Gemini generateContent(systemInstruction + prompt)
        │
        ▼
Gemini 2.5 Flash → optimized prompt text
        │
        ▼
server.js → JSON { optimized: "..." }
        │
        ▼
background.js → sendResponse({ success: true, data })
        │
        ▼
content.js: renderGhost() → absolute-positioned <div> overlay
        │
        ▼
User presses Tab → applySuggestion() replaces text
```

### 5.2 Manual Transform Flow

```
User types in popup textarea → clicks "Transform Text"
        │
        ▼
App.jsx: chrome.runtime.sendMessage({ action: 'transformText', prompt })
        │
        ▼
background.js: fetch('https://ghost-prompt.vercel.app/transform', POST)
        │
        ▼
server.js: Gemini → JSON array ["concise", "detailed"]
        │
        ▼
App.jsx: renders 2 result cards with copy buttons
```

---

## 6. Identified Architectural Gaps

| # | Gap | Severity | Impact |
|---|---|---|---|
| G-01 | **No database layer** — zero persistence of user history, prompts, or analytics | High | Cannot track usage, offer history, or monetize |
| G-02 | **No authentication** — API is open to the public internet | Critical | Anyone can call `/optimize` and `/transform`, burning Gemini credits |
| G-03 | **No rate limiting** — no server-side or client-side throttling | High | Vulnerable to abuse and cost explosion |
| G-04 | **No error telemetry** — errors logged to console only | Medium | No visibility into production failures |
| G-05 | **No analytics pipeline** — no tracking of usage patterns | Medium | No data-driven product decisions |
| G-06 | **No test suite** — zero unit, integration, or E2E tests | High | Regressions go undetected |
| G-07 | **No CI/CD pipeline** — manual builds and deploys | Medium | Error-prone release process |
| G-08 | **API key in `.env` committed to git history** | Critical | Key may be compromised in repo history |
| G-09 | **Build currently broken** — CSS import path error in `App.jsx` | High | Cannot produce fresh popup builds |
| G-10 | **No extension icon/branding assets** | Low | Missing `default_icon` in manifest |
| G-11 | **Single-model dependency** — hardcoded to Gemini 2.5 Flash | Medium | No fallback if Gemini is down or rate-limited |
| G-12 | **No prompt caching** — identical prompts re-call Gemini every time | Medium | Wasted API credits and latency |

---

## 7. Target Architecture (To-Be)

The target state introduces five new subsystems while preserving the existing working extension:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT: Chrome Extension                      │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────────────────────────┐ │
│  │  POPUP UI        │   │  CONTENT SCRIPT                      │ │
│  │  + Auth UI       │   │  + Rate limiter (client-side)        │ │
│  │  + History view  │   │  + Prompt cache (sessionStorage)     │ │
│  │  + Usage stats   │   │  + Error telemetry beacon            │ │
│  └──────┬────────────┘   └───────────┬────────────────────────┘ │
│         └──────────┬─────────────────┘                           │
│               ┌────▼─────────────────┐                           │
│               │  BACKGROUND SERVICE  │                           │
│               │  + Auth token mgmt   │                           │
│               │  + Request queue     │                           │
│               └────┬─────────────────┘                           │
└────────────────────┼─────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  SERVER: Vercel Serverless (Enhanced)                          │
│                                                                │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Auth     │ │ Rate      │ │ Cache    │ │ Analytics      │  │
│  │ Middleware│ │ Limiter   │ │ Layer    │ │ Collector      │  │
│  └────┬─────┘ └─────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       └─────────┬────┘            │               │            │
│            ┌────▼────────────┐    │               │            │
│            │  API Routes     │◄───┘               │            │
│            │  /optimize      │                    │            │
│            │  /transform     │                    │            │
│            │  /auth/*        │                    │            │
│            │  /history       │                    │            │
│            └────┬────────────┘                    │            │
└─────────────────┼─────────────────────────────────┼────────────┘
                  │                                 │
          ┌───────▼───────┐                ┌───────▼─────────┐
          │ Google Gemini │                │ Database        │
          │ 2.5 Flash     │                │ (Supabase /     │
          │               │                │  Firebase)      │
          └───────────────┘                └─────────────────┘
```

---

## 8. Security Architecture

### Current Threat Surface

| Threat | Current Mitigation | Required Mitigation |
|---|---|---|
| Unauthorized API access | None (open endpoint) | API key auth or JWT tokens |
| Gemini API key exposure | `.env` (but was in git history) | Rotate key, Vercel env vars only |
| Prompt injection via overlay | None | Input sanitization on server |
| XSS via ghost overlay | `escapeHTML()` in content.js | Maintain; add CSP headers |
| Cost explosion from abuse | None | Server-side rate limiting |

---

## 9. Cross-References

- **Database Architecture →** `directives/02_database_architecture.md`
- **Service Architecture →** `directives/03_service_architecture.md`
- **Execution Script Plan →** `directives/04_execution_script_plan.md`
- **Risk Analysis →** `directives/05_risk_analysis.md`
- **Implementation Roadmap →** `directives/06_implementation_roadmap.md`
