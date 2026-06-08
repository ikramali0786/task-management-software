# Marketing Site + Support — Design

**Date:** 2026-06-08
**Status:** Approved

## Goal
Add a public marketing site (so visitors can learn about TaskFlow) and a support
area (help center + contact), with a clean handoff: after signup/login users land
in the existing authenticated app — like a typical professional SaaS.

## Decisions (locked)
- **Routing:** the authenticated app moves under `/app/*`; marketing lives at
  public root paths.
- **Pages (v1 core):** Landing, Features, Pricing, Help Center (+ article pages),
  Contact, plus a shared marketing header/footer.
- **Support:** built-in help center (client-side content) + a contact form that
  emails the support inbox via Resend.

## 1. Routing & architecture

```
PUBLIC (MarketingLayout)        APP (AuthGuard, was "/")     AUTH (GuestGuard)
/            Landing            /app          Dashboard      /login
/features    Features           /app/board    Kanban         /register
/pricing     Pricing            /app/team     Team           /forgot-password
/help        Help center        /app/my-tasks My Tasks       /reset-password
/help/:slug  Help article       /app/workload Workload       /verify-email
/contact     Contact            /app/activity Activity       /join
/privacy     (existing)         /app/chatbots Chatbots       /status
                                /app/calendar Calendar
                                /app/settings Settings
```

- `router/index.tsx`: change the AuthGuard layout route `path: '/'` → `path: '/app'`
  (children unchanged: `index` = Dashboard, `board`, `team`, …). Add public routes
  under a new `MarketingLayout`.
- **Link migration (main risk):** prefix every in-app destination with `/app`:
  `Sidebar` nav, `GlobalSearch` navigation commands, team-switch `navigate()`,
  post-login/register redirects, logout target, `GuestGuard` default (`/` → `/app`),
  404 "go home". Grep-sweep `navigate('/`, `to="/`, and redirect defaults.
- `GuestGuard` sends authenticated users to `/app`; `AuthGuard` still sends
  unauthenticated users to `/login`. After login/register → `/app`.

## 2. Marketing pages (Atelier design system — ember accent, existing fonts)
- **MarketingLayout** — sticky header (logo; Features, Pricing, Help; Login +
  "Get started" CTA) and footer (product / support / legal links). Public, no auth.
- **Landing** (`/`) — hero + value prop, feature highlights, "why TaskFlow" band,
  plan teaser, closing CTA → `/register`.
- **Features** (`/features`) — real capabilities grouped (Kanban & real-time, AI,
  automations, API/webhooks, Slack, custom fields, 2FA, exports…).
- **Pricing** (`/pricing`) — reuses `FEATURE_MATRIX` + `PLAN_PRICES` from
  `lib/plans.ts` (single source of truth). Free / Pro / Business per seat. CTAs →
  `/register` when logged out, `/app/settings?billing=plans` when logged in.

## 3. Signup / purchase → app handoff
Marketing CTAs route to `/register`; on success the user lands on `/app`. Actual
purchase remains **in-app** (Settings → Billing → Stripe), which already works and
requires a team context — so we do not attempt Stripe checkout from the logged-out
marketing site.

## 4. Support
- **Help Center** (`/help`): categorized FAQ/articles stored in a client content
  module (`lib/helpContent.ts`); client-side search; article pages at `/help/:slug`.
  No CMS.
- **Contact** (`/contact`): form (name, email, subject, message) → `POST
  /api/support/contact` which emails `SUPPORT_EMAIL` (env; default the founder
  address) via Resend. Honeypot field + rate limiting; graceful "we'll get back to
  you" message and a no-op when Resend isn't configured.

## 5. Components / boundaries
- `components/marketing/MarketingLayout.tsx`, `MarketingHeader`, `MarketingFooter`.
- `pages/marketing/LandingPage.tsx`, `FeaturesPage.tsx`, `PricingPage.tsx`,
  `HelpPage.tsx`, `HelpArticlePage.tsx`, `ContactPage.tsx`.
- `lib/helpContent.ts` (help articles), `services/supportService.ts`.
- Server: `controllers/support.controller.ts`, `routes/support.routes.ts`,
  `env.SUPPORT_EMAIL`, a `sendSupportEmail` in the email service.

## 6. Testing / verification
- Server: unit test for the contact controller (validation + payload shape).
- Client: `npm run build` typecheck; preview click-through of public routes and the
  `/app` redirect for authenticated users.

## 7. Out of scope (YAGNI for v1)
Blog/CMS, About/Changelog pages, live-chat widget, marketing i18n, A/B testing.
