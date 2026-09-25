# Server boundaries

- API route handlers validate HTTP requests and wire server-only services.
- Incident services own deterministic severity, state, and persistence flow.
- The database directory contains the PostgreSQL pool; feature repositories define storage contracts.
- The investigation directory contains server-only AI calls that return advisory findings only.
- Voice UI calls the provider adapter; the client never imports database, OpenAI, or other private server credentials.
- Ticket, escalation, and correlation integrations are separate future service areas. The decision engine reports the next action but does not claim an external side effect has happened.
