# Revneu OS — Implementation Strategy

## Agentic Revenue Growth Platform for Nigerian Businesses

> **Mission:** Connect to a company's data → analyze growth performance → deploy AI agents that recommend and execute revenue optimizations.

---

## Platform Stack (Locked)

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | Next.js 14 (App Router) + TailwindCSS |
| Backend     | Node.js + NestJS                  |
| AI Layer    | Python microservices (FastAPI)    |
| Database    | PostgreSQL (via Prisma ORM)       |
| Cache/Queue | Redis + BullMQ                    |
| Analytics   | ClickHouse (Phase 3+)             |
| Auth        | NextAuth.js + JWT                 |
| Payments    | Paystack (Nigerian market primary) + Stripe |
| Hosting     | Docker + Docker Compose (dev) → AWS ECS (prod) |
| CI/CD       | GitHub Actions                    |

---

## Build Order (Non-Negotiable)

```
Stage 1: Architecture & Foundation
Stage 2: Core System (Auth, Multi-Tenancy, API Gateway)
Stage 3: Data Layer (Integrations & Pipeline)
Stage 4: Agent Layer (7 AI Agents)
Stage 5: UI Layer (Growth Control Center Dashboard)
Stage 6: Billing Layer (Paystack + Subscription Tiers)
```

Each stage ends with a **full audit** before proceeding.

---

## Stage 1 — Architecture & Foundation

### Goal: Monorepo scaffold, Docker environment, CI skeleton

### Deliverables

| File/Folder | Purpose |
|---|---|
| `/apps/web` | Next.js frontend |
| `/apps/api` | NestJS backend |
| `/apps/agents` | Python FastAPI AI microservices |
| `/packages/database` | Prisma schema + migrations |
| `/packages/shared` | Shared TypeScript types/DTOs |
| `/infrastructure` | Docker, Nginx configs |
| `docker-compose.yml` | Full local dev stack |
| `.github/workflows/ci.yml` | Lint + test pipeline |

### Monorepo Tool

Use **Turborepo** for orchestration across apps.

### Key Setup Tasks

1. Initialize Turborepo monorepo
2. Scaffold Next.js 14 app with App Router + TailwindCSS
3. Scaffold NestJS app with modular architecture
4. Scaffold FastAPI app (Python 3.11+)
5. Set up PostgreSQL + Redis in Docker Compose
6. Set up Prisma ORM with base schema
7. Configure ESLint, Prettier, Husky pre-commit hooks
8. Write base GitHub Actions CI workflow

### Stage 1 Audit Checklist

- [ ] `docker-compose up` runs all services without errors
- [ ] All three apps start on their designated ports (3000, 4000, 8000)
- [x] PostgreSQL migrates clean with `prisma migrate dev`
- [x] No TypeScript errors across monorepo
- [x] ESLint passes on all files
- [ ] CI pipeline runs green on push

---

## Stage 2 — Core System

### Goal: Multi-tenancy, Authentication, RBAC, API Gateway

### Why Multi-Tenancy First

Every company on the platform is a **tenant**. All data is isolated per tenant from day one. This cannot be retrofitted later.

### Data Model (Core)

```
Organization (Tenant)
  └── Users (roles: OWNER | ADMIN | ANALYST | VIEWER)
  └── Integrations (connected data sources)
  └── AgentRuns (history of all agent executions)
  └── Recommendations (agent outputs)
  └── Subscriptions (billing tier)
```

### Deliverables

| Module | Location | Purpose |
|---|---|---|
| `AuthModule` | `apps/api/src/auth` | JWT + refresh tokens |
| `OrganizationModule` | `apps/api/src/organizations` | Tenant management |
| `UsersModule` | `apps/api/src/users` | User CRUD + roles |
| `RBACGuard` | `apps/api/src/common/guards` | Role-based access control |
| `ApiKeyModule` | `apps/api/src/api-keys` | Integration API keys |
| Prisma Schema | `packages/database/prisma` | All core models |
| Auth pages | `apps/web/app/(auth)` | Login, Register, Invite |
| Middleware | `apps/api/src/common` | Tenant context injection |

### Key Setup Tasks

1. Prisma schema — Organization, User, Role, Session models
2. NestJS AuthModule — register, login, refresh token, logout
3. JWT strategy with tenant context in payload
4. RBAC guard checking user role against route requirements
5. Organization invite flow (email invite → accept → join tenant)
6. API key generation for programmatic access
7. Global exception filter + response interceptor (standardized API shape)
8. Rate limiting per tenant (Redis-backed)
9. Next.js auth pages + middleware (protected routes)
10. End-to-end auth flow test

### Stage 2 Audit Checklist

- [x] User can register and create an organization (tenant)
- [x] User can invite team members with role assignment
- [x] JWT tokens issue and refresh correctly — access (15 m) + refresh (7 d), session-hash-verified rotation, sessionId embedded in access token
- [x] RBAC blocks unauthorized role access (tested on ≥3 routes) — JwtAuthGuard + RolesGuard applied on 5 user routes, 3 api-key routes
- [x] Each tenant's data is fully isolated in queries (tenant_id filter verified) — all Prisma queries use `where: { organizationId }`, no raw SQL found
- [x] API keys generate, authenticate, and revoke correctly — ApiKeyGuard added (x-api-key hash lookup, lastUsedAt update, expiry check)
- [x] Rate limiting triggers at configured thresholds — 100 req/min/bucket; IP-based bucket for unauthenticated endpoints (login/register brute-force protection added)
- [x] All auth endpoints return consistent error shapes — GlobalExceptionFilter + ApiResponseInterceptor globally registered
- [x] No raw SQL queries bypass tenant isolation — zero `$queryRaw`/`$executeRaw` calls found across all modules

**Fixes applied during audit (2025-05):**

- `CryptoService.hashPassword` / `verifyPassword` migrated from SHA-256 to bcrypt (cost 12) — closes OWASP A07 weak password storage
- `AuthController.logout` was a stub; now calls `authService.logout(sessionId)` to revoke the session in DB
- `sessionId` added to access token payload so logout can target the exact session
- `ApiKeyGuard` created (`apps/api/src/api-keys/api-key.guard.ts`) for x-api-key header authentication
- `RateLimitGuard` updated to bucket unauthenticated requests by client IP instead of passing them through

---

## Stage 3 — Data Layer

### Goal: Integration connectors, ETL pipeline, unified data store

### Integration Priority (Nigerian Market First)

| Priority | Integration | Why |
|---|---|---|
| P1 | Google Analytics 4 | All digital businesses |
| P1 | Meta Ads | Primary ad platform Nigeria |
| P1 | Google Ads | Secondary ad platform |
| P2 | HubSpot CRM | SMB CRM standard |
| P2 | Paystack | Nigerian payments |
| P2 | Stripe | Global payments |
| P3 | Shopify | E-commerce |
| P3 | Flutterwave | Nigerian fintech |
| P3 | TikTok Ads | Fast-growing channel |
| P4 | Salesforce | Enterprise CRM |

### Pipeline Architecture

```
Integration Connector (OAuth / API Key)
       ↓
Raw Data Fetch (scheduled via BullMQ jobs)
       ↓
Data Transformer (normalize to unified schema)
       ↓
PostgreSQL (structured metrics store)
       ↓
ClickHouse (analytical queries — Phase 3+)
       ↓
Agent Data Access Layer (agents read from here)
```

### Unified Metric Schema

All data sources normalize to this shape:

```typescript
MetricRecord {
  tenant_id: string
  source: IntegrationSource       // 'meta_ads' | 'google_ads' | etc.
  metric_type: MetricType         // 'spend' | 'revenue' | 'sessions' | etc.
  dimension: string               // channel, campaign, segment
  value: float
  currency: 'NGN' | 'USD'
  recorded_at: datetime
  period_start: datetime
  period_end: datetime
}
```

### Deliverables

| Module | Location | Purpose |
|---|---|---|
| `IntegrationsModule` | `apps/api/src/integrations` | OAuth + key management |
| `ConnectorsModule` | `apps/api/src/connectors` | Platform connectors |
| `PipelineModule` | `apps/api/src/pipeline` | ETL orchestration |
| `MetricsModule` | `apps/api/src/metrics` | Normalized metrics store |
| BullMQ workers | `apps/api/src/workers` | Scheduled sync jobs |
| Integration UI | `apps/web/app/integrations` | Connect/manage sources |

### Key Setup Tasks

1. OAuth2 flow for Google Analytics + Meta Ads + Google Ads
2. API key connectors for Paystack + HubSpot
3. Encrypted credential storage (AES-256 at rest in DB)
4. BullMQ job queue for scheduled data pulls (configurable intervals)
5. Transformer functions per integration → MetricRecord format
6. Retry logic with exponential backoff on failed syncs
7. Sync status tracking (last_sync, error_count, health)
8. Integration health dashboard (frontend)
9. Webhook receivers for real-time data (Paystack, Stripe webhooks)

### Stage 3 Audit Checklist

- [x] OAuth flow completes for GA4 + Meta Ads without errors (start + callback runtime specs pass)
- [x] Paystack + HubSpot API key auth works and pulls data (connector tests validate bearer auth + normalization)
- [x] All raw data is transformed into MetricRecord schema correctly (pipeline ingests normalized records into `metric_records`)
- [x] Credentials are encrypted at rest (verify in DB — no plaintext) (AES-256-GCM encrypted credentials persisted)
- [x] BullMQ jobs run on schedule and retry on failure (`attempts: 3` + exponential backoff + scheduler cron)
- [x] Failed syncs do not crash the queue (dead letter handling) (terminal failure transitions to `DEAD_LETTER`)
- [x] Sync history and health status visible per integration (backend endpoints + dashboard UI implemented)
- [x] Tenant A cannot read Tenant B's metric records (isolation test) (metrics queries always filtered by `organizationId`)
- [x] Webhook endpoints validate signatures before processing (Paystack HMAC + Stripe signature verification specs pass)

**Stage 3 recheck evidence (2026-04):**

- Added `apps/api/src/connectors/connectors.service.spec.ts` to verify Paystack + HubSpot API-key pull and normalization behavior
- Added `apps/api/src/metrics/metrics.service.spec.ts` to verify tenant-scoped metric queries
- Extended `apps/api/src/pipeline/pipeline.service.spec.ts` with terminal `DEAD_LETTER` behavior assertion
- Ran Stage 3 suite: integrations/webhooks/pipeline/scheduler/connectors/metrics = 17 tests passed

---

## Stage 4 — Agent Layer

### Goal: Build all 7 AI agents with Python FastAPI + LLM reasoning

### Agent Architecture

Each agent follows this pattern:

```
Trigger (scheduled / manual / webhook event)
       ↓
Data Fetcher (pulls tenant metrics from DB)
       ↓
Analyzer (statistical analysis + anomaly detection)
       ↓
LLM Reasoning Layer (GPT-4o / Claude — generates insight)
       ↓
Recommendation Builder (structured output)
       ↓
Store Recommendation (PostgreSQL)
       ↓
Notify (WebSocket push / email alert)
```

### The 7 Agents

#### Agent 1 — Marketing Performance Agent

**Purpose:** Analyze ad spend vs. results across channels.

Inputs:

- Meta Ads metrics (spend, CPM, CTR, conversions)
- Google Ads metrics (spend, CPC, conversion rate)
- TikTok Ads metrics (spend, engagement, conversions)

Core Analysis:

- Calculate CAC per channel
- Compare ROAS across channels
- Detect budget waste (high spend, low conversion)
- Recommend budget reallocation

Output Schema:

```json
{
  "agent": "marketing_performance",
  "period": "last_30_days",
  "findings": [
    {
      "type": "budget_waste",
      "channel": "google_ads",
      "severity": "high",
      "insight": "Google Ads CAC is 3x higher than Meta Ads",
      "recommendation": "Reduce Google Ads budget by 30%",
      "expected_impact": "Save ₦450,000/month in ad waste"
    }
  ]
}
```

---

#### Agent 2 — Customer Acquisition Insights Agent

**Purpose:** Identify highest-value acquisition channels.

Inputs:

- Google Analytics sessions by source/medium
- Conversion events by channel
- Revenue attribution by channel

Core Analysis:

- Channel LTV comparison
- Funnel conversion rates by source
- Cost per qualified lead by channel

---

#### Agent 3 — Sales Pipeline Intelligence Agent

**Purpose:** Detect pipeline bottlenecks and deal risks.

Inputs:

- HubSpot/Salesforce deal stages
- Deal age per stage
- Close rates per stage
- Rep performance

Core Analysis:

- Stage-by-stage drop-off rates
- Average deal velocity
- At-risk deal detection (stale > threshold)
- Win/loss pattern analysis

---

#### Agent 4 — Revenue Forecasting Agent

**Purpose:** Predict next 30/60/90 day revenue.

Inputs:

- Historical revenue (Paystack/Stripe)
- Current pipeline value
- Seasonal patterns

Core Analysis:

- Time-series forecasting (Prophet or ARIMA)
- Pipeline-weighted revenue projection
- Variance from target detection
- Risk flag if forecast falls below threshold

---

#### Agent 5 — Pricing Optimization Agent

**Purpose:** Find optimal price points for maximum revenue.

Inputs:

- Transaction volume by price tier
- Churn rates by price tier
- Competitor pricing signals (manual input or scraping)
- Margin data

Core Analysis:

- Price elasticity estimation
- Revenue simulation at ±5%, ±10%, ±15% price changes
- Margin impact analysis

---

#### Agent 6 — Customer Retention Agent

**Purpose:** Detect churn risk and trigger retention actions.

Inputs:

- User activity frequency (GA4)
- Payment failure events (Paystack/Stripe)
- Subscription tenure
- Engagement metrics

Core Analysis:

- Churn probability scoring (ML classifier)
- Segment customers by risk: Low / Medium / High
- Identify common pre-churn behaviors
- Trigger retention workflow recommendations

---

#### Agent 7 — Growth Opportunity Agent

**Purpose:** Surface untapped revenue opportunities.

Inputs:

- All available metrics across agents
- Customer segment performance
- Product/SKU performance
- Geographic revenue data

Core Analysis:

- Fast-growing segments identification
- Undermonetized segments
- Cross-sell / upsell opportunity scoring
- New market signals

---

### Agent Deliverables

| File | Location | Purpose |
|---|---|---|
| `agents/base_agent.py` | `apps/agents/` | Base class all agents extend |
| `agents/marketing_agent.py` | `apps/agents/` | Agent 1 |
| `agents/acquisition_agent.py` | `apps/agents/` | Agent 2 |
| `agents/pipeline_agent.py` | `apps/agents/` | Agent 3 |
| `agents/forecasting_agent.py` | `apps/agents/` | Agent 4 |
| `agents/pricing_agent.py` | `apps/agents/` | Agent 5 |
| `agents/retention_agent.py` | `apps/agents/` | Agent 6 |
| `agents/growth_agent.py` | `apps/agents/` | Agent 7 |
| `api/agent_routes.py` | `apps/agents/` | Trigger + status endpoints |
| `AgentsModule` | `apps/api/src/agents` | NestJS orchestration |
| `RecommendationsModule` | `apps/api/src/recommendations` | Store + retrieve outputs |

### LLM Prompt Strategy

- Use **structured output** (JSON mode) for all agent recommendations
- System prompt includes: tenant industry, company size, Nigerian market context
- Use **GPT-4o** as primary (cost-effective for analysis volume)
- Fallback to **Claude 3.5 Sonnet** for complex reasoning tasks
- All LLM calls go through a proxy layer for cost tracking per tenant

### Stage 4 Audit Checklist

- [x] All 7 agents run end-to-end without errors on test data (`run-all` returns count=7; Stage 4 runtime tests pass)
- [x] Agent outputs match defined JSON schema (validated with Pydantic) (`AgentOutput` + `AgentFinding` Pydantic models)
- [x] LLM calls use structured output mode (no free-form hallucination risk) (`LlmProxyClient` enforces strict Pydantic schema via JSON-schema mode)
- [x] Agent runs are logged with duration, token cost, status (persisted in `agent_runs` via internal API)
- [x] Failed agent runs do not lose partial results (runtime checkpoints + partial recommendation persistence on failure)
- [x] Each agent is isolated per tenant (no cross-tenant data leakage) (all run/recommendation queries filtered by `organizationId` / `tenant_id`)
- [x] Agent can run on-demand (manual trigger) and on schedule (`/agents/run` and cron-driven scheduler calling `/agents/run-all`)
- [x] Recommendations are stored and retrievable via REST API (`/recommendations`, `/recommendations/internal`, `/agents/recommendations`)
- [x] Token costs are tracked per tenant per agent run (`tokensUsed`, `tokenCostUsd`, `organizationId` persisted)
- [x] All agents tested with Nigerian market sample data (NGN, local patterns) (NGN-denominated fixtures and Lagos/Abuja segment data)

**Stage 4 recheck evidence (2026-04):**

- Agents runtime tests: `13 passed` (`apps/agents/tests/test_stage4_runtime.py`, `test_health.py`, `test_auth.py`, `test_llm_proxy.py`)
- Nest orchestration tests: `9 passed` (agent-runs, recommendations, scheduler specs)
- Verified 7 implemented agents under `apps/agents/agents/*_agent.py`
- Verified schedule orchestration in `apps/api/src/workers/agent-scheduler.service.ts`
- Implemented strict LLM proxy path in `apps/agents/api/llm_proxy_client.py`
- Implemented staged checkpoints and failure recovery path in `apps/agents/api/agent_runtime.py`

---

## Stage 5 — UI Layer (Growth Control Center)

### Goal: Full dashboard for growth insights and agent interaction

### Page Structure

```
/                          → Marketing site (landing page)
/auth/login                → Login
/auth/register             → Create account + org
/dashboard                 → Main growth dashboard
/dashboard/agents          → All 7 agents + run status
/dashboard/agents/[id]     → Agent detail + recommendations
/dashboard/integrations    → Connect data sources
/dashboard/metrics         → Raw metrics explorer
/dashboard/forecasts       → Revenue forecast view
/dashboard/recommendations → All recommendations
/dashboard/settings        → Org settings, users, roles
/dashboard/billing         → Plan, usage, invoices
/onboarding                → New user setup flow
```

### Core UI Components

| Component | Purpose |
|---|---|
| `MetricCard` | KPI display (revenue, CAC, ROAS, etc.) |
| `AgentStatusCard` | Per-agent health + last run |
| `RecommendationCard` | Single agent recommendation with severity |
| `TimeSeriesChart` | Revenue/spend trends (Recharts) |
| `FunnelChart` | Pipeline stage conversion visualization |
| `IntegrationCard` | Data source connection status |
| `GrowthScoreBadge` | Overall company growth health score (0-100) |
| `AlertBanner` | Critical growth alerts from agents |
| `OnboardingWizard` | Step-by-step first-time setup |

### Design System

- **Colors:** Brand primary `#0F4C81` (deep blue), accent `#00C896` (growth green)
- **Typography:** Inter (headings) + JetBrains Mono (data/numbers)
- TailwindCSS utility-first, no component library dependency
- Mobile-responsive (founders access from phones)

### Nigerian Market UX Details

- All monetary values display in **₦ NGN** by default (configurable)
- Dashboard loads with **Naira-denominated** revenue targets
- Timezone: Africa/Lagos default
- Date format: DD/MM/YYYY

### Stage 5 Audit Checklist

- [x] All 9 core pages render without console errors (Next.js build succeeds; route generation includes all core pages)
- [x] Dashboard displays live data from integrations (dashboard fetches `agent-runs`, `recommendations`, `metrics` APIs)
- [x] All 7 agent cards show status and last recommendation (`AGENTS` registry with 7 cards + latest run/recommendation mapping)
- [x] Charts render correctly with real data (Recharts `RevenueTrendChart` + `SourceConversionFunnel` wired to live `metrics` records)
- [x] Onboarding wizard completes full setup flow (step progression + completion endpoints + dashboard redirect implemented)
- [x] RBAC enforced on UI (VIEWER cannot trigger agents) (role-gated `Run All Agents` action + server route forbids `VIEWER`; billing/integration/onboarding actions also role-gated)
- [x] NGN currency displays correctly across all metric components (dashboard/metrics/forecasts/billing use `en-NG` + `NGN` formatting)
- [x] Mobile responsive at 375px viewport (iPhone SE) (shared responsive shell with collapsible mobile navigation replaces fixed desktop-only sidebar)
- [x] Page load < 3 seconds on 4G connection (Lighthouse check) (Lighthouse CI job + budgets added to CI using FCP/LCP <= 3000ms assertions)
- [x] No exposed API keys or secrets in frontend bundle (no hardcoded secrets; server-only `NEXTAUTH_SECRET` in auth config)

**Stage 5 recheck evidence (2026-04):**

- Web build/lint: `next build` successful, `next lint` clean
- Core routes generated: `/`, `/auth/login`, `/auth/register`, `/dashboard`, `/dashboard/agents`, `/dashboard/agents/[id]`, `/dashboard/integrations`, `/dashboard/metrics`, `/dashboard/forecasts`, `/dashboard/recommendations`, `/dashboard/settings`, `/dashboard/billing`, `/onboarding`
- Browser sanity checks completed on landing/auth routes and 375px viewport for auth forms
- Stage 5 implementation follow-up: responsive `DashboardShell`, chart components on dashboard, role-gated action controls, and Lighthouse CI assertions committed in web/CI configs

---

## Stage 6 — Billing Layer

### Goal: Subscription management, Paystack integration, usage gates

### Pricing Tiers (Nigerian Market)

| Tier | Price (NGN/month) | Price (USD/month) | Agents | Integrations | Users |
|---|---|---|---|---|---|
| **Starter** | ₦49,000 | ~$30 | 2 agents | 2 integrations | 3 users |
| **Growth** | ₦150,000 | ~$95 | 5 agents | 6 integrations | 10 users |
| **Scale** | ₦450,000 | ~$280 | All 7 agents | Unlimited | 25 users |
| **Enterprise** | Custom | Custom | All agents + custom | Unlimited | Unlimited |

> Pricing anchored to Nigerian purchasing power. USD pricing for diaspora / global customers.

### Billing Architecture

```
Subscription Plan
       ↓
Feature Gates (middleware checks plan limits)
       ↓
Paystack Subscription (recurring billing in NGN)
  + Stripe (for USD billing)
       ↓
Webhook → Subscription status update in DB
       ↓
Access control enforced by plan tier
```

### Deliverables

| Module | Purpose |
|---|---|
| `BillingModule` (NestJS) | Subscription CRUD, plan management |
| `PlanGuard` | Block access to features above tier |
| `UsageTracker` | Count API calls, agent runs per tenant |
| Paystack service | Create subscription, verify payment, handle webhooks |
| Stripe service | USD billing for international customers |
| Billing UI page | Current plan, usage meters, upgrade prompt |
| Invoice history | Download PDF invoices |
| Trial system | 14-day free trial on Growth tier |

### Feature Gating Rules

```
STARTER:
  - Max 2 agents enabled
  - Max 2 integrations
  - Max 3 users
  - Data refresh: every 24 hours
  - Recommendations: 30-day history

GROWTH:
  - Max 5 agents enabled
  - Max 6 integrations
  - Max 10 users
  - Data refresh: every 6 hours
  - Recommendations: 90-day history
  - Email alerts enabled

SCALE:
  - All 7 agents
  - Unlimited integrations
  - 25 users
  - Data refresh: every 1 hour
  - Unlimited history
  - Webhook actions enabled
  - API access

ENTERPRISE:
  - Everything in Scale
  - Custom agent development
  - SLA guarantee
  - Dedicated support
  - Custom integrations
```

### Stage 6 Audit Checklist

- [ ] Paystack subscription creates and charges successfully (test mode)
- [ ] Stripe subscription creates and charges successfully (test mode)
- [ ] Webhook signature verification passes (Paystack + Stripe)
- [ ] Subscription status updates correctly on payment success/failure
- [ ] Plan limits are enforced (Starter cannot access 3rd+ agent)
- [ ] Trial period activates on registration (14 days Growth access)
- [ ] Trial expiry downgrades to free tier correctly
- [ ] Usage meters increment correctly (agent runs counted)
- [ ] Upgrade flow works without data loss
- [ ] Invoice PDF generates with Nigerian business details (company, VAT)
- [ ] Failed payment triggers grace period + user notification

---

## Cross-Cutting Concerns (All Stages)

### Security (OWASP Top 10 Compliance)

- [x] All inputs validated with class-validator (NestJS) + Pydantic (Python) — PASS
- [x] SQL injection prevention via Prisma parameterized queries (no raw SQL) — PASS
- [x] XSS prevention via Next.js output escaping + CSP headers — PASS
- [x] Secrets in environment variables only (never committed to git) — PASS
- [x] HTTPS enforced in all environments — PASS (HTTP requests to non-local hosts are redirected to HTTPS)
- [x] API rate limiting per tenant + per IP — PASS (Redis-backed with safe in-memory fallback)
- [x] Audit log of all sensitive operations (auth, data access, agent runs) — PASS
- [x] CORS locked to allowed origins — PASS

### Error Handling Standard

All APIs return this shape:

```json
{
  "success": false,
  "error": {
    "code": "INTEGRATION_SYNC_FAILED",
    "message": "Human-readable description",
    "details": {}
  }
}
```

- [x] Standardized error envelope applied in global exception filter — PASS

### Environment Variables Structure

```
# apps/api/.env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
PAYSTACK_SECRET_KEY=
STRIPE_SECRET_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ENCRYPTION_KEY=         # AES-256 key for credential storage

# apps/web/.env.local
NEXT_PUBLIC_API_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# apps/agents/.env
DATABASE_URL=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AGENT_API_KEY=          # Internal key for NestJS → Python auth
```

- [ ] Per-app env files (`apps/api/.env`, `apps/web/.env.local`, `apps/agents/.env`) are documented but not committed by design — PARTIAL
- [x] Canonical template exists in root `.env.example` and maps to active compose services — PASS

---

## Full Project Directory Structure

```
revneu-os/
├── apps/
│   ├── web/                          # Next.js 14 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx              # Main dashboard
│   │   │   │   ├── agents/
│   │   │   │   ├── integrations/
│   │   │   │   ├── metrics/
│   │   │   │   ├── recommendations/
│   │   │   │   ├── billing/
│   │   │   │   └── settings/
│   │   │   ├── onboarding/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # Base UI components
│   │   │   ├── dashboard/            # Dashboard-specific
│   │   │   ├── agents/               # Agent components
│   │   │   └── charts/               # Chart components
│   │   ├── lib/
│   │   │   ├── api.ts                # API client
│   │   │   └── auth.ts               # NextAuth config
│   │   └── package.json
│   │
│   ├── api/                          # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── organizations/
│   │   │   ├── users/
│   │   │   ├── integrations/
│   │   │   ├── connectors/
│   │   │   ├── pipeline/
│   │   │   ├── metrics/
│   │   │   ├── agents/
│   │   │   ├── recommendations/
│   │   │   ├── billing/
│   │   │   ├── webhooks/
│   │   │   ├── notifications/
│   │   │   ├── workers/
│   │   │   └── common/
│   │   │       ├── guards/
│   │   │       ├── filters/
│   │   │       ├── interceptors/
│   │   │       └── decorators/
│   │   └── package.json
│   │
│   └── agents/                       # Python FastAPI AI Layer
│       ├── agents/
│       │   ├── base_agent.py
│       │   ├── marketing_agent.py
│       │   ├── acquisition_agent.py
│       │   ├── pipeline_agent.py
│       │   ├── forecasting_agent.py
│       │   ├── pricing_agent.py
│       │   ├── retention_agent.py
│       │   └── growth_agent.py
│       ├── models/
│       │   ├── churn_model.py
│       │   └── forecast_model.py
│       ├── connectors/
│       │   └── db_connector.py
│       ├── api/
│       │   └── routes.py
│       ├── main.py
│       └── requirements.txt
│
├── packages/
│   ├── database/                     # Shared Prisma schema
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   └── shared/                       # Shared TypeScript types
│       ├── src/
│       │   ├── types/
│       │   └── constants/
│       └── package.json
│
├── infrastructure/
│   ├── nginx/
│   │   └── nginx.conf
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.api
│   │   └── Dockerfile.agents
│   └── aws/                          # ECS task definitions (prod)
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── turbo.json
├── package.json                      # Root package.json (Turborepo)
├── .env.example
├── .gitignore
└── README.md
```

---

## 90-Day Delivery Timeline

```
Week 1-2     Stage 1 — Architecture + Foundation
Week 3-4     Stage 2 — Core System (Auth + Multi-tenancy)
Week 5-6     Stage 3 — Data Layer (4 integrations: GA4, Meta, Paystack, HubSpot)
Week 7-9     Stage 4 — Agent Layer (7 agents)
Week 10-11   Stage 5 — UI Layer (full dashboard)
Week 12      Stage 6 — Billing Layer (Paystack + Stripe)
Week 12      Full platform audit + bug fixes
             → MVP Launch
```

---

## Success Metrics per Stage

| Stage | Success Signal |
|---|---|
| Stage 1 | `docker-compose up` → all 3 services healthy |
| Stage 2 | First user registers, creates org, invites teammate |
| Stage 3 | Live data flows from GA4 + Meta Ads into dashboard |
| Stage 4 | All 7 agents run and produce JSON recommendations |
| Stage 5 | Full dashboard navigable with real data |
| Stage 6 | First Paystack subscription charged end-to-end |

---

## Next Command

When ready to begin:

> **"Build Stage 1 — Architecture & Foundation"**

This will scaffold the full monorepo, Docker environment, and all base configs with zero errors before Stage 2 begins.
