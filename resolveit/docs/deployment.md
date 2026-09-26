# Deploying ResolveIT (free tier)

| Piece | Service | Plan |
| --- | --- | --- |
| Code | GitHub | Free |
| Web app | Vercel | Hobby (free, non-commercial) |
| Database | Neon Postgres | Free |
| Voice | Vapi | Existing account (calls use credits) |

## 1. Database (Neon)

1. Create a Neon project and copy the **pooled** connection string (the host contains `-pooler`).
2. From `resolveit/`, create the schema and your accounts. The shell variable overrides `.env.local`:

   ```powershell
   $env:DATABASE_URL = "<Neon pooled connection string>"
   pnpm db:migrate
   pnpm user:create you@company.com IT_ADMIN "Your Name"
   pnpm user:create employee@company.com EMPLOYEE "Employee Name"
   Remove-Item Env:DATABASE_URL
   ```

   `pnpm db:seed` refuses to run against a hosted database: its test passwords are public.

## 2. Web app (Vercel)

- Import the GitHub repo and set **Root Directory** to `resolveit`.
- **Environment variables:**
  - `DATABASE_URL` (Neon)
  - `AUTH_SECRET` (a **new** random value, different from local)
  - `OPENAI_API_KEY`
  - `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID`
  - `VAPI_WEBHOOK_SECRET`
  - `IT_SUPPORT_PHONE`
  - `RESOLVEIT_AI_PHONE_NUMBER`
  - `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the pnpm version in `package.json`
- Deploying gives you `https://<project>.vercel.app`.

## 3. Vapi

- **Phone:** replace the tunnel URL with `https://<project>.vercel.app/api/vapi/webhook` in three places: the phone `prepare_incident` tool, the `transferCall` tool, and the ResolveIT Phone assistant.
- **Browser voice:** add `https://<project>.vercel.app` to the public key's allowed origins.

## Security notes

- Accounts are created only with `pnpm user:create`. There is no public sign-up.
- Sessions are HMAC-signed, httpOnly cookies, marked `Secure` in production.
- Sign-in has no rate limiting yet. Use the generated passwords.
