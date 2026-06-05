# ARTales mail setup

This document records the current ARTales mail/auth setup after moving from Supabase default e-mails to custom SMTP.

## Current production setup

- Public domain: `https://artales.net`
- Technical fallback domain: `https://ar-tales.vercel.app`
- DNS: Cloudflare
- Auth mail sender: `ARTales <no-reply@artales.net>`
- SMTP provider: Resend
- Supabase Auth: custom SMTP enabled

## Supabase URL configuration

Supabase → Authentication → URL Configuration:

### Site URL

```txt
https://artales.net
```

### Redirect URLs

Keep these production URLs:

```txt
https://artales.net/auth/callback
https://artales.net/reset-password
https://artales.net/onboarding
```

Keep these while `www` exists as a valid domain / redirect:

```txt
https://www.artales.net/auth/callback
https://www.artales.net/reset-password
https://www.artales.net/onboarding
```

Keep these for local development:

```txt
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
http://localhost:3000/onboarding
```

Optional technical fallback while Vercel URL remains usable:

```txt
https://ar-tales.vercel.app/auth/callback
https://ar-tales.vercel.app/reset-password
https://ar-tales.vercel.app/onboarding
```

## Supabase SMTP settings

Supabase → Authentication → Emails → SMTP Settings:

```txt
Enable custom SMTP: ON
Sender email address: no-reply@artales.net
Sender name: ARTales
Host: smtp.resend.com
Port: 465
Minimum interval per user: 60
Username: resend
Password: <Resend API key>
```

Never commit or paste the Resend API key into code, docs, chat, screenshots, or tickets. If the key is exposed, revoke it in Resend and create a new one.

## Environment variables

Vercel production should include:

```txt
NEXT_PUBLIC_SITE_URL=https://artales.net
```

Local development should use:

```txt
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`APP_URL` is still accepted as a legacy fallback, but new code should rely on `NEXT_PUBLIC_SITE_URL` through `lib/appUrl.ts`.

## DNS checklist

Cloudflare DNS should contain the Vercel records for:

```txt
artales.net
www.artales.net
```

Resend domain verification records should stay in Cloudflare as provided by Resend:

```txt
SPF / TXT
DKIM / TXT or CNAME
DMARC / TXT
Return-path / CNAME if provided
```

Mail-related CNAME records must be DNS-only, not proxied.

## Test checklist

After any mail/DNS/auth change, test:

1. New reader signup.
2. Account confirmation link.
3. Invite flow for reader/member/editor.
4. Forgot password/reset password.
5. Delivery to Gmail.
6. Delivery to Seznam.
7. Links resolve to `artales.net`, not the old Vercel URL.

## Current policy

- Supabase Auth e-mails use Resend SMTP.
- Future app e-mails can use Resend API directly.
- Transactional mail and newsletter/broadcast mail must stay conceptually separate.
- Newsletter/broadcast mail needs opt-in and unsubscribe handling before public use.
