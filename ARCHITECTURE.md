# BotFlow Platform Architecture

## Product Vision

BotFlow is a premium AI automation SaaS for businesses to manage customer communication across WhatsApp, Instagram, TikTok, and Messenger from one unified dashboard.

**Production domains**
| Service  | Domain              | Port |
|----------|---------------------|------|
| Frontend | `botflow.ink`       | 3000 |
| API      | `api.botflow.ink`   | 8000 |

## Monorepo Layout (GitHub org: `sass-botflow`)

```
sass-botflow/
├── backend/     → NestJS API (this repo)
└── frontend/    → Next.js 15 app
```

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Frontend       | Next.js 15, TypeScript, Tailwind, Shadcn UI, Framer Motion |
| Backend        | NestJS, Prisma, PostgreSQL, Redis   |
| Auth           | JWT, Google OAuth, Email/Password   |
| Payments       | Stripe (Starter / Pro / Agency)     |
| Infrastructure | Docker, EasyPanel, GitHub Actions   |

## Backend Module Map

```
src/
├── main.ts
├── app.module.ts
├── common/           # Guards, decorators, filters, Prisma service
├── config/           # Env validation
└── modules/
    ├── auth/         # JWT, Google OAuth, register/login
    ├── users/        # User profile
    ├── organizations/# Multi-tenant, agency mode, team roles
    ├── inbox/        # Unified multi-channel conversations
    ├── bots/         # AI agent builder, workflow nodes
    ├── crm/          # Contacts, pipelines, lead scoring
    ├── appointments/ # Calendar, availability, reminders
    ├── analytics/    # Dashboard metrics
    ├── knowledge/    # PDF/DOCX/URL knowledge base
    ├── billing/      # Stripe subscriptions
    ├── notifications/# Email + in-app
    ├── settings/     # Branding, domains, API keys
    └── integrations/ # Channel connectors (WhatsApp, IG, etc.)
```

## Frontend Route Map

```
app/
├── (marketing)/          # Landing, pricing
├── (auth)/               # Login, register
└── (dashboard)/
    ├── inbox/            # Unified inbox
    ├── bots/             # Agent builder
    ├── crm/              # Contacts & pipelines
    ├── appointments/     # Booking calendar
    ├── analytics/        # Charts & KPIs
    ├── knowledge/        # Knowledge base uploads
    ├── team/             # Roles & permissions
    ├── billing/          # Subscription management
    └── settings/         # Branding, integrations
```

## Database Entities (Prisma)

- **Auth & Tenancy:** User, Organization, OrganizationMember, ApiKey
- **Billing:** Subscription, Invoice
- **Channels:** ChannelConnection
- **Inbox:** Contact, Conversation, Message, ConversationTag, ConversationNote, InternalComment
- **Bots:** Bot, WorkflowNode, WorkflowEdge
- **CRM:** Pipeline, PipelineStage, Deal, ContactTag
- **Appointments:** AvailabilitySlot, Appointment
- **Knowledge:** KnowledgeBase, KnowledgeDocument
- **Settings:** BrandingSettings, Integration
- **Notifications:** Notification

## Deployment (EasyPanel)

### Backend
```env
PORT=8000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
STRIPE_SECRET_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Frontend
```env
PORT=3000
NEXT_PUBLIC_API_URL=https://api.botflow.ink
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

## Implementation Phases

1. **Foundation** — Prisma schema, NestJS modules, Next.js shell, Docker
2. **Auth & Billing** — JWT, Google, Stripe plans
3. **Inbox & CRM** — Conversations, contacts, pipelines
4. **Bot Builder** — Visual workflow engine
5. **Integrations** — WhatsApp, Instagram, TikTok, Messenger webhooks
6. **Agency Mode** — White-label, multi-client
