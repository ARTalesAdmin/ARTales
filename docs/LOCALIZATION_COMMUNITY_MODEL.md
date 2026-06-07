# ARTales Localization & Community Model

## v0.9.7d rebuild

This patch completes the unfinished Locale, Follow Management & Feedback Triage scope.

### Localization

- Public/account localization remains gradual, not complete.
- Guests store interface language in the `artales_locale` cookie.
- Signed-in users store the same preference in `profiles.preferred_locale`.
- The public header now visibly switches the main navigation labels.

### Follow management

- Author follows are managed through `author_follows`.
- `/account/community` is the primary reader-side place for managing followed authors.
- `/account/library` shows a compact followed-author preview and links to community management.

### Feedback triage

`work_feedback` is treated as private reader input into the editorial membrane, not a public comment stream.

The simple triage state is:

```txt
new → acknowledged
```

Additional columns:

- `acknowledged_at`
- `acknowledged_by_user_id`

The member community page can mark reader inputs as acknowledged. Deeper editorial routing, author handoff, credits, reputation, and contribution workflow are intentionally left for later patches.
