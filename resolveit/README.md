# ResolveIT

ResolveIT is an AI incident intelligence platform for employees and IT teams. It is one application with two roles:

- **EMPLOYEE** — reports problems by talking to an AI voice assistant or with a form, and follows their own tickets.
- **IT_ADMIN** — works the incident queue: sees every incident, the AI investigation and decision, and manages status, assignment, and notes.

## Incident flow

```
Report (voice or form) → incident saved → AI investigation → decision engine → stored result
                                                               ├─ queue a ticket for IT
                                                               ├─ suggest a safe self-service fix
                                                               └─ escalate to a human (status ESCALATED)
```

1. **Manual report:** the employee fills in the form and submits. The ticket is created immediately.
2. **Voice report (browser or phone):** the Vapi assistant talks with the employee, suggests safe fixes, and calls the client-side tool `prepare_incident`.
   - If required facts are missing, ResolveIT tells the assistant what to ask next.
   - When the draft is complete, ResolveIT **creates the ticket automatically** (no confirmation step), speaks the ticket reference, and ends the call.
   - See [docs/vapi-assistant-setup.md](docs/vapi-assistant-setup.md).
3. **Investigation:** the server-side OpenAI investigator (advisory only) assesses the likely cause, impact, recommended steps, and whether a human is needed. It sees incident facts only, never requester identity.
4. **Decision:** deterministic rules in `src/features/decisions/engine.ts` choose the action:
   - **CRITICAL** always escalates to a human.
   - **HIGH / MEDIUM** escalate when the AI judges human intervention is required. If the AI is unavailable, HIGH escalates and MEDIUM is queued as a prioritized ticket.
   - **LOW** gets a self-service suggestion only when the AI found a safe, reversible fix; otherwise it is queued as a normal ticket.
5. **Storage:** the investigation, decision, escalation, and every status change, assignment, and note are stored. The IT dashboard and the employee's ticket view read the same record, so IT status changes appear for the employee immediately.

### Human escalation

Escalated incidents get status **ESCALATED** and appear at the top of the IT queue.

- **Browser AI:** the employee is told IT will contact them. Browser calls cannot be transferred.
- **Phone AI:** the employee calls the ResolveIT AI number (`RESOLVEIT_AI_PHONE_NUMBER`). When ResolveIT escalates the call's ticket, Vapi transfers the live call to `IT_SUPPORT_PHONE`, and IT already has the ticket, investigation, and transcript. See [docs/vapi-assistant-setup.md](docs/vapi-assistant-setup.md).

`IT_SUPPORT_PHONE` is server-only. It is sent to Vapi as the transfer destination and never shown to employees.

## Security model

- Identity and role always come from the signed session cookie (HMAC-signed, httpOnly, SameSite=Lax). The request body cannot set `requesterId`, `severity`, or `status`.
- Employees only see incidents they reported. Another person's incident returns 404.
- Only IT_ADMIN can change status, assign, or add notes. Assignees must be IT staff.
- IT notes are either **internal** (IT only, never returned to employees) or **visible to the employee**. This is enforced in the service layer (`getDetail`).

## Architecture

- `src/app` — pages (employee portal `/my-incidents`, IT queue `/`, reporting `/incidents/new`, detail `/incidents/[id]`, `/login`) and API routes.
- `src/features/incidents` — model, validation, filters, labels, normalization, service, repository contract, PostgreSQL repository, UI components.
- `src/features/voice` — Vapi provider, draft schema, submission gateway, agent messages, session outcome logic, voice UI.
- `src/features/decisions` — deterministic decision engine.
- `src/features/auth` — login form.
- `src/server` — session auth, env config, database pool, OpenAI investigator, incident workflow runner.
- `database/migrations` — versioned SQL schema.

## API

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | anyone | Sign in |
| POST | `/api/auth/logout` | signed in | Sign out (form POST, redirects to `/login`) |
| POST | `/api/incidents` | signed in | Create an incident; returns the incident plus investigation and decision |
| GET | `/api/incidents` | signed in | List incidents. Employees get only their own. Filters: `status`, `severity`, `category`, `source`, `assignee` (`me`, `unassigned`, or ID), `from`, `to`, `sort` |
| GET | `/api/incidents/:id` | owner or IT | Incident detail |
| PATCH | `/api/incidents/:id` | IT_ADMIN | `{ status?, assigneeId?, note?: { body, visibility: "INTERNAL" \| "PUBLIC" } }` |
| POST | `/api/vapi/webhook` | Vapi (shared secret) | Phone channel: `prepare_incident` tool calls, transfer destination, end-of-call transcript |

## Environment

Copy `.env.example` to `.env.local` (ignored by Git) and fill in:

- `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — local PostgreSQL.
- `AUTH_SECRET` — **required** to sign in; a long random value.
- `OPENAI_API_KEY` — server-only; enables AI investigation. Without it, decisions use the priority rules only.
- `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` — browser-safe Vapi public key and assistant. Without them, voice is disabled and the form still works.
- `IT_SUPPORT_PHONE` — server-only; the live-transfer destination for escalated phone calls.
- `VAPI_WEBHOOK_SECRET` — server-only; shared secret Vapi sends to `/api/vapi/webhook`.
- `RESOLVEIT_AI_PHONE_NUMBER` — the Vapi number employees call; shown on the employee dashboard.
- `VAPI_TRANSFER_MODE` — optional: `blind-transfer` (default) or a warm mode (Twilio numbers only).

Link an employee's phone for caller ID with `pnpm db:set-phone <email> <+E.164 number>`.

## Local development

```
pnpm install
pnpm db:up        # PostgreSQL in Docker
pnpm db:migrate   # apply migrations
pnpm db:seed      # local test accounts (development only)
pnpm dev
```

Open http://localhost:3000 and sign in. `pnpm db:seed` prints the local development accounts. They are for local use only.

## Checks

```
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
