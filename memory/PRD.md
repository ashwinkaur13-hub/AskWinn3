# AskWinn — PRD

## Original Problem Statement
> I want to build a one stop sourcing platform where the users who are starting business work can find the manufacturing agents who can do end to end product management.

Platform name: **AskWinn**.

## Architecture
- **Backend**: FastAPI + MongoDB (motor) + Emergent Google OAuth + Emergent LLM key (LLM + object storage)
- **Frontend**: React 19 + react-router-dom 7 + Tailwind + editorial Shadcn overrides
- **Design**: Bold editorial — bone #F9F9F6, Klein blue #002FA7, burn orange #FF4500, Cormorant Garamond + Manrope + IBM Plex Mono

## Personas
- **Buyer** — founder posting RFQs
- **Vendor / Agent** — manufacturing agent receiving RFQs, bidding, fulfilling
- **Admin** — moderates + verifies vendors

## Core Vendor Journey (from requirement sheet)
- Phase 1: Registration + KYC + verification + (stubbed) onboarding fee
- Phase 2: Vendor dashboard with metrics
- Phase 3: RFQ notification, anonymous detail view, bid submission
- Phase 4: Order fulfilment with status flow + (stubbed) escrow
- Phase 5: Vendor scoring, badges, repeat & referral

## What's been implemented (running totals through iteration 5)

| Iter | Date | Focus | Tests |
|---|---|---|---|
| 1 | 2026-04-23 | MVP — auth, profiles, RFQ, quotes, AI match, messaging, reviews, admin | 17/17 |
| 2 | 2026-04-23 | Pre-OAuth role pick + pluggable AI bid evaluator | 24/24 |
| 3 | 2026-04-23 | Rebrand AskWinn + contact_number on quote + Accept Winner | 30/30 |
| 4 | 2026-04-30 | Guided RFQ wizard (Beauty/Textile/Electronics) + file uploads | 45/45 |
| 5 | 2026-04-30 | Vendor workflow Phases 1-5 (KYC, metrics, anonymisation, status flow, score+badges); ISSUE overline removed | 59/59 |

### 2026-04-30 — Vendor workflow (iteration 5)
- **Phase 1 KYC**: pan_number, gst_number, business_address, factory_city, factory_state, years_in_operation, factory_video_url (URL), catalogue_url, availability_status (active/paused) on AgentProfile + UI in AgentProfileEdit
- **Phase 2 Vendor Dashboard**: GET /api/agents/me/metrics → 6 tiles (RFQs received, Active bids, Orders won, Earnings, Vendor score, Reviews)
- **Phase 3 anonymisation**: agent viewing an RFQ sees 'Verified Buyer' + competing quotes as 'Anonymous bidder' with no pitch text; identity revealed only to buyer-owner, admin, and winning agent
- **Phase 3 Pass** (POST /api/rfqs/{id}/pass): RFQ removed from that agent's list
- **Phase 3 sample fields** on quote form: sample_available + sample_cost_usd
- **Phase 4 status flow**: Confirmed → Packed → Dispatched (+optional tracking URL) → Delivered. Endpoints validate role + monotonic forward transitions. Agent drives until dispatched; buyer marks delivered.
- **Phase 5 Vendor Score**: rating*10 + win_rate*30 + verified bonus, capped at 100. Auto-recalculated on quote submission, accept, and delivery.
- **Phase 5 Badges**: top_vendor (win_rate≥0.4, ≥3 quotes), fast_responder (avg_response<4h), high_quality (rating≥4.5, ≥3 reviews); rendered on dashboard, profile, and quote cards.
- **Landing**: removed "ISSUE Nº01 — EDITORIAL SOURCING" overline.

### Stubbed (pending external integrations)
- Razorpay onboarding fee (Phase 1.4) and escrow (Phase 4.12, 4.14) — needs key
- WhatsApp notifications via Wati/Interakt (Phase 3.7, 3.10, 4.11) — banners only for now
- GST government API verification (Phase 1.3) — admin manual verify only
- Resend email notifications — pending API key

## Prioritized backlog

### P0
- Buyer "save favourites" agent list
- Public shareable RFQ link

### P1
- Resend email notifications (needs key)
- Razorpay onboarding fee + escrow at sample order
- WhatsApp notifications (Wati/Interakt)
- File attachments inside chat threads
- Structured forms for remaining categories

### P2
- Stripe escrow (alternative if buyers are global)
- Self-hosted Ollama bid evaluator
- Repeat order & referral credit system (Phase 5.17)

## Integrations
- Emergent Google OAuth — login
- Emergent Universal LLM Key — Claude Sonnet 4.5 (agent match) + Gemini 2.5 Flash Lite (bid eval)
- Emergent Object Storage — RFQ attachments
