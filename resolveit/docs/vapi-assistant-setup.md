# ResolveIT Vapi setup

ResolveIT has two voice channels. Both use the **same** incident rules, AI investigation, decision engine, escalation, and transcript storage.

| | Browser AI | Phone AI |
| --- | --- | --- |
| How employees reach it | *Report a problem → Talk to AI* | Call the ResolveIT AI number shown on *My tickets* |
| Vapi assistant | Browser assistant (`NEXT_PUBLIC_VAPI_ASSISTANT_ID`) | Separate phone assistant, attached to the Vapi phone number |
| `prepare_incident` runs in | The browser (client-side tool, no server URL) | ResolveIT's webhook `POST /api/vapi/webhook` (server tool) |
| Employee identity | Signed-in session | Caller ID matched to `users.phone_number` (`pnpm db:set-phone`) |
| Human escalation | ESCALATED ticket; IT contacts the employee | ESCALATED ticket, then a **live transfer** to `IT_SUPPORT_PHONE` |

Two assistants are required because a client-side tool only works when a browser is on the call.

The IT support number (`IT_SUPPORT_PHONE`) is only sent from ResolveIT's server to Vapi, as the transfer destination for escalated phone calls. It is never stored in Vapi, never shown or spoken to employees, and never sent to the browser.

---

## Browser assistant

### How it works

1. The employee clicks **Start talking**. The assistant asks questions and suggests safe fixes.
2. **Solved:** the assistant says goodbye and the call ends. No ticket is created.
3. **Not solved:** the assistant calls `prepare_incident`. Vapi delivers it to the browser.
   - Missing facts: ResolveIT sends the assistant a system message (`add-message`) and it asks follow-up questions.
   - Complete: ResolveIT creates the ticket automatically, speaks the reference, and ends the call.
   - Escalated: the ticket is created as ESCALATED and the employee is told IT will contact them. Browser calls are never transferred.

Client-side tools cannot return results to the model ([Vapi docs](https://docs.vapi.ai/tools/client-side-websdk)), which is why the browser uses `add-message` and `say`.

### System prompt (browser assistant)

> You are the ResolveIT IT support assistant. You talk with an employee who has an IT problem. Be warm, brief, and plain-spoken; the employee may not be technical.
>
> 1. Understand the problem. Ask short follow-up questions, one at a time, only for what you still need: what is happening, which system or app, symptoms, exact error messages, when it started, whether it is still happening, how many people are affected, how it affects their work, and what they already tried.
> 2. If there is a simple, safe, reversible step the employee can try (for example restarting an app, reconnecting to Wi-Fi, signing out and in), suggest it once and ask whether it helped. Never ask them to change security settings, install software, or share passwords, codes, or tokens.
> 3. If the problem is now solved, confirm it, say goodbye, and end the call without calling prepare_incident.
> 4. If it is not solved, judge urgency: LOW (inconvenient), MEDIUM (slowed down), HIGH (can't do important work), CRITICAL (many people stopped, security or data at risk, or a safety issue). If the employee clearly needs a person from IT, set humanAssistanceRequested to true. Then call prepare_incident with every field you know, using the employee's own words. Use null for anything unknown and never invent facts.
> 5. After calling prepare_incident, say only "One moment while I create your ticket." and wait. Never say a ticket was created, escalated, or given a number until a RESOLVEIT SYSTEM message tells you.
> 6. If a RESOLVEIT SYSTEM message says information is missing, ask for exactly that, then call prepare_incident again with all fields.
> 7. You cannot transfer calls or take any action in IT systems. Never claim you did, and never give out phone numbers.

### `prepare_incident` tool (browser)

A **Function** tool with **no Server URL** and **Async on**, attached to the browser assistant. The parameters are listed in [Tool parameters](#tool-parameters). The assistant's **Client Messages** must include `tool-calls` and `transcript`.

---

## Phone assistant

### How it works

1. The employee calls the ResolveIT AI number. The phone assistant answers and runs the same conversation.
2. **Solved:** the assistant says goodbye and ends the call. No ticket is created.
3. **Not solved:** the assistant calls `prepare_incident`. Vapi sends it to `POST /api/vapi/webhook`, which:
   - identifies the caller by caller ID. An unknown number creates an unlinked ticket that IT can still see;
   - validates the draft with the same rules as the browser, and asks for anything missing;
   - creates the incident (source **Phone AI**), runs the AI investigation and decision, and escalates when required;
   - returns instructions to the assistant: say the ticket number and next step, then end the call, **or**, when escalated, say IT is being connected and use `transferCall`.
4. **Transfer:** `transferCall` has **no destination** in Vapi. Vapi asks ResolveIT (`transfer-destination-request`) and ResolveIT returns `IT_SUPPORT_PHONE` **only if** that call's ticket is ESCALATED. The timeline records "Phone call transferred to IT support".
5. **End of call:** Vapi sends the end-of-call report and ResolveIT saves the full transcript on the ticket.

The IT person sees the ticket, AI investigation, decision, escalation reason, troubleshooting, and transcript in ResolveIT, so the employee does not need to repeat themselves.

### Transfer modes and limits

- **Blind transfer** (default, `VAPI_TRANSFER_MODE=blind-transfer`): the caller is connected directly. This works with a Vapi number, subject to Vapi's current number limits.
- **Warm transfer** (`warm-transfer-say-message` or `warm-transfer-say-summary`): Vapi first speaks a short briefing to IT, for example "ResolveIT escalation, ticket INC 42, critical priority: …". Warm transfer requires a **Twilio** number imported into Vapi.
- **Free Vapi numbers** are US-only and inbound-only ([Vapi free telephony](https://docs.vapi.ai/free-telephony)). If a transfer from a free number fails in testing, import a Twilio number instead.

### System prompt (phone assistant)

> You are the ResolveIT IT support assistant answering a phone call from an employee. Be warm, brief, and plain-spoken.
>
> 1. Greet the caller and ask what's wrong. Ask short follow-up questions, one at a time, only for what you still need: what is happening, which system or app, symptoms, exact error messages, when it started, whether it is still happening, how many people are affected, how it affects their work, and what they already tried. Also ask for their name and work email, and pass them as callerName and callerEmail.
> 2. If there is a simple, safe, reversible step they can try, suggest it once and ask whether it helped. Never ask them to change security settings, install software, or share passwords, codes, or tokens.
> 3. If the problem is now solved, confirm it, say goodbye, and use endCall. Do not call prepare_incident.
> 4. If it is not solved, judge urgency: LOW (inconvenient), MEDIUM (slowed down), HIGH (can't do important work), CRITICAL (many people stopped, security or data at risk, or a safety issue). If they clearly need a person from IT, set humanAssistanceRequested to true. Say "One moment while I create your ticket." and call prepare_incident with every field you know. Use null for anything unknown and never invent facts.
> 5. Follow the RESOLVEIT instructions returned by prepare_incident exactly: ask for missing information and call it again, or tell the caller their ticket number and next step and use endCall, or, if it says to transfer, tell the caller you are connecting them to IT support and use transferCall.
> 6. Only use transferCall when a RESOLVEIT instruction tells you to. Never read out or invent any phone number.

---

## Tool parameters

`prepare_incident`, used by both assistants. The phone version also accepts `callerName` and `callerEmail`.

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string", "description": "Short summary, at least 5 characters" },
    "description": { "type": "string", "description": "What is happening, at least one full sentence" },
    "category": { "type": "string", "enum": ["ACCOUNT_ACCESS", "COMPUTER_HARDWARE", "NETWORK_CONNECTIVITY", "SOFTWARE_APPLICATIONS", "EMAIL_COLLABORATION", "OTHER"] },
    "urgency": { "type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    "affectedUsers": { "type": "integer", "minimum": 1 },
    "businessImpact": { "type": "string", "description": "How the problem affects the employee's work" },
    "affectedSystem": { "type": ["string", "null"] },
    "symptoms": { "type": ["string", "null"] },
    "startedAt": { "type": ["string", "null"], "description": "When it started, in the employee's words" },
    "currentlyAffected": { "type": ["boolean", "null"] },
    "errorMessages": { "type": "array", "items": { "type": "string" } },
    "troubleshootingAttempted": { "type": "array", "items": { "type": "string" }, "description": "Steps already tried, including ones you suggested" },
    "additionalContext": { "type": ["string", "null"] },
    "humanAssistanceRequested": { "type": "boolean", "description": "True if a person from IT is clearly needed" },
    "callerName": { "type": ["string", "null"], "description": "Phone only: the caller's name" },
    "callerEmail": { "type": ["string", "null"], "description": "Phone only: the caller's work email" }
  },
  "required": ["title", "description", "category", "urgency", "affectedUsers", "businessImpact"]
}
```

Never add `severity`, `status`, or ID fields; ResolveIT rejects them.

## Environment

| Variable | Where it is used | Visible to employees? |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | Browser assistant | Public by design (restrict them in Vapi) |
| `VAPI_WEBHOOK_SECRET` | Authenticates Vapi → `/api/vapi/webhook` | No, server only |
| `IT_SUPPORT_PHONE` | Phone transfer destination | **Never** |
| `RESOLVEIT_AI_PHONE_NUMBER` | Shown on the employee dashboard | Yes |
| `VAPI_TRANSFER_MODE` | Blind or warm transfer | No |

No Vapi private API key is needed. Vapi calls ResolveIT, not the other way round.
