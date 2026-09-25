# ResolveIT Vapi assistant

The browser uses the official @vapi-ai/web SDK. Configure an assistant in your Vapi dashboard and assign a public API key to that assistant. The public key is designed for browser SDKs; restrict it to http://localhost:3000 during local development and your deployed origin in production, and allow only this assistant.

## Assistant instructions

Use this system prompt:

> You are ResolveIT, an IT support incident intake agent. Your goal is to understand the employee's problem and prepare an accurate incident report for the ResolveIT application. Ask natural, short follow-up questions only for important missing information. Collect the issue, affected application or system, symptoms, when it started, whether it is ongoing, number of affected users, business impact, error messages, troubleshooting already attempted, urgency, and useful context. Do not ask for passwords, access tokens, or authentication codes. Do not invent facts. Leave unknown values blank. Do not claim to have diagnosed, resolved, submitted, escalated, or created a ticket. You cannot take operational actions. When you have enough information, summarize it and call prepare_incident with the structured fields. The employee must review and submit the draft in ResolveIT.

## Client tool

Add a function/client tool named prepare_incident; leave its Server URL unset so the Web SDK receives its tool call. Include tool-calls in the assistant's client messages. Define parameters as a strict object with no additional properties:

- title: string or null
- description: string or null
- category: one of ACCOUNT_ACCESS, COMPUTER_HARDWARE, NETWORK_CONNECTIVITY, SOFTWARE_APPLICATIONS, EMAIL_COLLABORATION, OTHER, or null
- affectedUsers: integer or null
- businessImpact: string or null
- urgency: one of LOW, MEDIUM, HIGH, CRITICAL, or null
- affectedSystem: string or null
- symptoms: string or null
- startedAt: string or null
- currentlyAffected: boolean or null
- errorMessages: array of strings
- troubleshootingAttempted: array of strings

The tool only puts a draft into the employee review UI; it cannot write to the database. ResolveIT validates the draft and the regular incident endpoint validates it again.

## Local configuration

The launcher asks for these non-secret values before starting:

    NEXT_PUBLIC_VAPI_PUBLIC_KEY=
    NEXT_PUBLIC_VAPI_ASSISTANT_ID=

The public key is intentionally sent to the browser and must be scoped in Vapi. Never place a Vapi private API key or the ResolveIT OpenAI key in a NEXT_PUBLIC_ variable. Start the app with scripts/dev-with-vapi.ps1 to supply OPENAI_API_KEY through hidden PowerShell input. Without Vapi's public key and assistant ID, voice stays unavailable and manual reporting continues to work.

## Verify

Open /incidents/new, choose Voice Report, allow microphone access, describe an IT issue, and wait for the agent to call prepare_incident. Review the incident fields and confirm submission. The Vapi conversation itself does not submit an incident. ResolveIT sends only the reviewed structured incident to POST /api/incidents.
