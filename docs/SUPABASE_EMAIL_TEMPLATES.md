# Supabase Auth email templates for ARTales

Use these as copy/paste templates in Supabase:

```txt
Authentication → Emails → Templates
```

The templates are intentionally simple and email-client friendly. The ARTales visual brand can be improved later, but auth e-mails should first be clear, deliverable, and reliable.

## Confirm signup

Subject:

```txt
Confirm your ARTales account
```

HTML body:

```html
<div style="margin:0;padding:0;background:#f6f1e8;font-family:Georgia,'Times New Roman',serif;color:#25180f;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fffaf1;border:1px solid #e1d2bd;border-radius:18px;padding:28px;">
      <div style="font-size:24px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px;">ARTales</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;">Confirm your account</h1>
      <p style="font-size:16px;line-height:1.65;margin:0 0 22px;">Welcome to ARTales. Confirm your e-mail address to finish creating your reader account.</p>
      <p style="margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2b1b11;color:#fffaf1;text-decoration:none;padding:13px 20px;border-radius:999px;font-size:15px;font-weight:700;">Confirm account</a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#6e5b49;margin:22px 0 0;">If you did not create this account, you can safely ignore this e-mail.</p>
    </div>
  </div>
</div>
```

## Reset password

Subject:

```txt
Reset your ARTales password
```

HTML body:

```html
<div style="margin:0;padding:0;background:#f6f1e8;font-family:Georgia,'Times New Roman',serif;color:#25180f;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fffaf1;border:1px solid #e1d2bd;border-radius:18px;padding:28px;">
      <div style="font-size:24px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px;">ARTales</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;">Reset your password</h1>
      <p style="font-size:16px;line-height:1.65;margin:0 0 22px;">We received a request to reset your ARTales password. Use the button below to choose a new password.</p>
      <p style="margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2b1b11;color:#fffaf1;text-decoration:none;padding:13px 20px;border-radius:999px;font-size:15px;font-weight:700;">Reset password</a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#6e5b49;margin:22px 0 0;">If you did not request this, you can safely ignore this e-mail.</p>
    </div>
  </div>
</div>
```

## Invite user

Subject:

```txt
You have been invited to ARTales
```

HTML body:

```html
<div style="margin:0;padding:0;background:#f6f1e8;font-family:Georgia,'Times New Roman',serif;color:#25180f;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fffaf1;border:1px solid #e1d2bd;border-radius:18px;padding:28px;">
      <div style="font-size:24px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px;">ARTales</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;">Your ARTales invitation</h1>
      <p style="font-size:16px;line-height:1.65;margin:0 0 22px;">You have been invited to join ARTales. Use the button below to continue.</p>
      <p style="margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2b1b11;color:#fffaf1;text-decoration:none;padding:13px 20px;border-radius:999px;font-size:15px;font-weight:700;">Accept invitation</a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#6e5b49;margin:22px 0 0;">If you did not expect this invitation, you can ignore this e-mail.</p>
    </div>
  </div>
</div>
```

## Magic link

Subject:

```txt
Your ARTales sign-in link
```

HTML body:

```html
<div style="margin:0;padding:0;background:#f6f1e8;font-family:Georgia,'Times New Roman',serif;color:#25180f;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fffaf1;border:1px solid #e1d2bd;border-radius:18px;padding:28px;">
      <div style="font-size:24px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px;">ARTales</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;">Sign in to ARTales</h1>
      <p style="font-size:16px;line-height:1.65;margin:0 0 22px;">Use this secure link to sign in to your ARTales account.</p>
      <p style="margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2b1b11;color:#fffaf1;text-decoration:none;padding:13px 20px;border-radius:999px;font-size:15px;font-weight:700;">Sign in</a>
      </p>
      <p style="font-size:13px;line-height:1.55;color:#6e5b49;margin:22px 0 0;">If you did not request this link, you can safely ignore this e-mail.</p>
    </div>
  </div>
</div>
```
