# ARTales Resend roadmap

ARTales currently uses Resend only as SMTP for Supabase Auth. Later, ARTales can also use Resend API directly from the app.

## Current scope

Handled by Supabase Auth through custom SMTP:

- account confirmation
- password reset
- invite / auth e-mails

## Future transactional mail

Potential app-generated e-mails:

- welcome e-mail after onboarding
- welcome unlock used
- manual grant assigned
- editor recommended grant
- admin approved/rejected grant request
- submission received
- submission returned to member
- work published
- purchase confirmation
- subscription started/changed/cancelled
- PDF/EPUB download ready

These should be logged in an ARTales mail/event table before launch-grade use.

## Future memberzone mail tools

Potential section:

```txt
/member/mail
```

Recommended permissions:

- Admin: can send real broadcasts/newsletters.
- Editor: can prepare drafts and send tests to self/admin.
- Member: no mail sending rights.
- Reader: can manage newsletter preferences later.

## Separation of mail types

### Transactional mail

Necessary service e-mails:

- auth
- purchases
- security
- access/entitlement confirmations

These do not require newsletter opt-in, but should still be minimal and relevant.

### Marketing/newsletter mail

Examples:

- new titles
- launch announcements
- promos
- author highlights
- editorial news

Requires opt-in, preference management, and unsubscribe before public use.

## Suggested future implementation

```txt
lib/mail/resend.ts
lib/mail/templates.ts
lib/mail/sendTransactionalMail.ts
lib/mail/audience.ts
app/member/mail/page.tsx
app/member/mail/actions.ts
```

Later database tables:

```txt
mail_events
mail_drafts
reader_email_preferences
newsletter_subscriptions
```
