# Revelao — Tomorrow Snap Reveal

## Setup

```sh
npm i
npm run dev
```

## Environment variables

### Frontend (`.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

### Supabase Edge Functions (Secrets)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
FROM_EMAIL=
LOGO_URL= (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_SMALL=
STRIPE_PRICE_MEDIUM=
STRIPE_PRICE_LARGE=
STRIPE_PRICE_XXL=
STRIPE_PRICE_CAPTAINS_GAME= (optional; defaults to the current 4.95 EUR "Juego" price)
STRIPE_PRICE_CAPTAINS_PACK=
APP_ORIGIN=
```

## Stripe webhook (local)

Use Stripe CLI to forward webhooks to Supabase Edge Functions:

```sh
stripe login
stripe listen --forward-to https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
```

## Notes

- Demo flow uses `create-demo-event` Edge Function to create user + demo event.
- Paid flow uses Stripe checkout + redeem link (`/redeem/:token`) to create paid events.
- Email confirmations are sent via `send-demo-event-email`.
- Demo reveal and 24-hour conversion emails are queued by the
  `20260804153000_add_demo_lifecycle_emails.sql` migration and processed every
  five minutes by `process-demo-lifecycle-emails`. Before applying the
  migration, store `project_url` and the project's public API key as
  `publishable_key` in Supabase Vault. If they are added after the migration,
  run `select public.schedule_demo_lifecycle_email_cron();` once in the SQL
  editor.
- Admin area is protected by Supabase Auth.
