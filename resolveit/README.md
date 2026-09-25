# ResolveIT

ResolveIT is an IT incident intake and intelligence platform. Employees can report through a Vapi-powered browser voice agent or the manual form. Incident records are validated and stored by ResolveIT; AI can investigate and recommend safe next steps, while deterministic server rules select severity actions.

## Incident flow

1. The employee reports an issue using voice or the manual form. Manual reporting remains available when voice is not configured.
2. The Vapi Web SDK handles microphone and real-time conversation. A browser-safe public Vapi key and assistant ID are restricted to the application's allowed origin and assistant.
3. The assistant may call the client-side prepare_incident tool to deliver a structured draft. ResolveIT validates it, shows an employee review form, and waits for explicit confirmation.
4. Confirmed voice and manual reports use the POST /api/incidents endpoint. The server validates the data and persists it to PostgreSQL; Vapi has no direct database access.
5. The server-side OpenAI Responses API investigator can summarize evidence and suggest a safe employee-performed remedy. Its output is advisory and schema-validated. It cannot set incident severity or perform operational actions.
6. ResolveIT's deterministic decision engine chooses a proposed outcome: safe low-severity resolution, standard ticket, prioritized ticket, or human escalation. Ticketing and escalation integrations are not yet connected; the API returns the decision without claiming those external actions were performed.

## Architecture

- src/app — Next.js pages and API routes.
- src/features/incidents — incident model, validation, intake service, repository contract, PostgreSQL repository, manual form.
- src/features/voice/providers — provider interface and Vapi Web SDK adapter.
- src/features/voice — Vapi conversation UI, draft validation, employee review, and incident API submission.
- src/features/decisions — deterministic severity decision rules.
- src/server/investigation — server-only OpenAI investigation boundary.
- src/server/database — PostgreSQL connection pool.
- database/migrations — versioned SQL schema, including voice incident context.

Vapi supplies the real-time conversation layer. ResolveIT retains incident validation, persisted records, investigation, severity decisions, and all future ticket/escalation integrations. There is no active ElevenLabs integration.

## Environment

Copy .env.example to .env.local and configure database settings there. .env.local is ignored by Git. The Vapi launcher prompts for browser-safe public configuration; it requests the OpenAI key through hidden input and keeps it only in the development server's environment.

- NEXT_PUBLIC_VAPI_PUBLIC_KEY — Vapi public API key for the browser SDK. Vapi explicitly designs this key for browser use. Restrict allowed origins and assistants in the Vapi dashboard; never put a private key in this variable.
- NEXT_PUBLIC_VAPI_ASSISTANT_ID — the ResolveIT incident intake assistant ID.
- OPENAI_API_KEY — private OpenAI key used only by the server-side investigation service.
- POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL — local PostgreSQL configuration.

Create the ResolveIT assistant in the Vapi dashboard and follow docs/vapi-assistant-setup.md. Choose a Vapi-supported model, voice, and transcriber in that account and add the prepare_incident client tool described in the guide. For an OpenAI-backed Vapi assistant, separately configure its provider credentials in Vapi; ResolveIT's OPENAI_API_KEY is never sent to Vapi.

## Local development

Codex's Windows environment provides Node.js and pnpm. If they are not on the shell PATH, use scripts/dev-with-vapi.ps1, which resolves the bundled executable paths. Install project dependencies with pnpm install; start PostgreSQL and apply migrations:

    pnpm db:up
    pnpm db:migrate
    pnpm dev

Visit http://localhost:3000. The dashboard is /; incident reporting is /incidents/new. The DB migration runner applies pending files once, and the local Compose volume retains incidents.

## API

- POST /api/incidents — validates and stores an incident; responds with the incident plus server-side investigation and deterministic decision status.
- GET /api/incidents — returns recent incidents for the dashboard.

The voice flow does not auto-submit or display raw JSON. Agent-supplied status and severity are rejected. The employee reviews and confirms the draft, and server validation runs again before storage.

## Checks

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

For the runtime-secure local server, run scripts/dev-with-vapi.ps1 instead of pnpm dev. Database setup requires Docker Desktop with its engine available. No AI or voice behavior is simulated when credentials are absent.
