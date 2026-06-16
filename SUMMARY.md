# Repository Summary — Prompt Ghost 👻

Prompt Ghost is a Chrome Extension + Serverless Backend system designed to provide real-time, AI-powered prompt optimization directly inside major Large Language Model (LLM) interfaces. The project is structured using the **PFA (Purpose-Facts-Action) Framework**, separating SOP definitions, orchestration flow, and deterministic execution tools into three clean tiers.

---

## 3-Layer PFA Architecture Mapping

| Layer | Component | Description / Role | Directory |
| :--- | :--- | :--- | :--- |
| **Layer 1 — Directives** | Standard Operating Procedures | Living Markdown directives outlining system architecture, database plans, API schemas, testing plans, risks, and implementation roadmaps. | [`directives/`](file:///c:/dev/masterprompt/directives/) |
| **Layer 2 — Orchestration** | Active AI Agent | Handles tactical workflows, error isolation, self-annealing modifications, and updates system SOPs. | *Agent Runtime* |
| **Layer 3 — Execution** | Deterministic Scripts & DB | Immutable Python tools handling builds, deployments, API/cache testing, security auditing, and database SQL migrations. | [`execution/`](file:///c:/dev/masterprompt/execution/) |

---

## Directory & Component Inventory

### 📁 [`directives/`](file:///c:/dev/masterprompt/directives/) — Living SOPs (Layer 1)
- [**project_master_plan.md**](file:///c:/dev/masterprompt/directives/project_master_plan.md): High-level overview index and critical roadmap checkmarks.
- [**01_system_architecture.md**](file:///c:/dev/masterprompt/directives/01_system_architecture.md): Overview of components, as-is data flow, architectural gaps, and target schemas.
- [**02_database_architecture.md**](file:///c:/dev/masterprompt/directives/02_database_architecture.md): Supabase PostgreSQL schema structures, entity relationships, and table properties.
- [**03_service_architecture.md**](file:///c:/dev/masterprompt/directives/03_service_architecture.md): API endpoint descriptions (auth, optimize, transform, usage), response schemas, and middleware.
- [**04_execution_script_plan.md**](file:///c:/dev/masterprompt/directives/04_execution_script_plan.md): Specifications and design rules for all PFA Layer 3 execution scripts.
- [**05_risk_analysis.md**](file:///c:/dev/masterprompt/directives/05_risk_analysis.md): Register tracking security, engineering, and availability risks.
- [**06_implementation_roadmap.md**](file:///c:/dev/masterprompt/directives/06_implementation_roadmap.md): 4-week deployment roadmap outlining milestones and timelines.

### 📁 [`execution/`](file:///c:/dev/masterprompt/execution/) — Deterministic Tools (Layer 3)
- [**requirements.txt**](file:///c:/dev/masterprompt/execution/requirements.txt): Environment dependencies.
- **Build & Packaging**:
  - [**build_popup.py**](file:///c:/dev/masterprompt/execution/build_popup.py) (E-01): Compiles Vite React Popup UI.
  - [**validate_manifest.py**](file:///c:/dev/masterprompt/execution/validate_manifest.py) (E-02): Verifies manifest.json for MV3 compliance.
  - [**package_extension.py**](file:///c:/dev/masterprompt/execution/package_extension.py) (E-03): Zips codebase into production unpacked archives.
  - [**deploy_vercel.py**](file:///c:/dev/masterprompt/execution/deploy_vercel.py) (E-04): Handles Vercel CLI deploys.
- **Database & Migrations**:
  - [**db_migrate.py**](file:///c:/dev/masterprompt/execution/db_migrate.py) (E-05): Runs sequential migration queries.
  - [**db_seed.py**](file:///c:/dev/masterprompt/execution/db_seed.py) (E-06): Populates developer mock data.
  - [**db_cleanup.py**](file:///c:/dev/masterprompt/execution/db_cleanup.py) (E-07): Cleans up TTL expired cache and log files.
- **Testing & Verification**:
  - [**test_api_endpoints.py**](file:///c:/dev/masterprompt/execution/test_api_endpoints.py) (E-08): Integration checks for /optimize and /transform.
  - [**test_cache_layer.py**](file:///c:/dev/masterprompt/execution/test_cache_layer.py) (E-09): Validates database lookup speeds.
  - [**test_rate_limiter.py**](file:///c:/dev/masterprompt/execution/test_rate_limiter.py) (E-10): Validates HTTP 429 burst behaviors.
  - [**test_auth_flow.py**](file:///c:/dev/masterprompt/execution/test_auth_flow.py) (E-11): Checks signup/login user lifecycles.
- **Monitoring & Security**:
  - [**health_check.py**](file:///c:/dev/masterprompt/execution/health_check.py) (E-12): Continuous uptime connectivity checks.
  - [**usage_report.py**](file:///c:/dev/masterprompt/execution/usage_report.py) (E-13): Aggregates daily usage statistics reports.
  - [**error_analysis.py**](file:///c:/dev/masterprompt/execution/error_analysis.py) (E-14): Retrospective grouping logs for self-healing inputs.
  - [**rotate_api_key.py**](file:///c:/dev/masterprompt/execution/rotate_api_key.py) (E-15): Automates Gemini credential rotation.
  - [**audit_env_security.py**](file:///c:/dev/masterprompt/execution/audit_env_security.py) (E-16): Scans repo for credentials exposure.

#### 📁 [`execution/migrations/`](file:///c:/dev/masterprompt/execution/migrations/) — Database Schema Updates
- [**001_create_users.sql**](file:///c:/dev/masterprompt/execution/migrations/001_create_users.sql): Schema for user authentication, plan tiers, and daily limits.
- [**002_create_prompt_history.sql**](file:///c:/dev/masterprompt/execution/migrations/002_create_prompt_history.sql): Schema for recording prompt optimize inputs, outputs, and user acceptance.
- [**003_create_cache_entries.sql**](file:///c:/dev/masterprompt/execution/migrations/003_create_cache_entries.sql): Cache database table layout for SHA-256 prompt mappings.
- [**004_create_usage_stats.sql**](file:///c:/dev/masterprompt/execution/migrations/004_create_usage_stats.sql): Daily tracking logs for limits mapping and billing.
- [**005_create_error_log.sql**](file:///c:/dev/masterprompt/execution/migrations/005_create_error_log.sql): Telemetry logging table for error traces.
- [**006_add_rls_policies.sql**](file:///c:/dev/masterprompt/execution/migrations/006_add_rls_policies.sql): Enforces Supabase Row-Level Security (RLS) rules so users only access their own data.

### 📁 [`src/`](file:///c:/dev/masterprompt/src/) — Chrome Extension Source
- [**content.js**](file:///c:/dev/masterprompt/src/content.js): Content script injected into AI textareas to detect input, trigger suggestions, and render translucent ghost text overlays.
- [**background.js**](file:///c:/dev/masterprompt/src/background.js): Service worker responsible for token caching, messaging relay, and routing network fetch suggestions.

### 📁 [`popup/`](file:///c:/dev/masterprompt/popup/) — React Extension Popover
- UI constructed with React 18, Vite, and Tailwind CSS.
- Handles manual variation transforms and settings selections.

### 📁 [`server/`](file:///c:/dev/masterprompt/server/) — Serverless API
- Express.js endpoints configured for Vercel deployment.
- Calls Gemini Generative AI SDK models for rewrite logic.

### 📁 [`.tmp/`](file:///c:/dev/masterprompt/.tmp/) — Volatile Data (Git Ignored)
- Stores intermediate runtime outputs, package zip files, and diagnostic files.
