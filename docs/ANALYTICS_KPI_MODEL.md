# ARTales Analytics / KPI model

Version: v0.9.6b

## Principle

`page_views` remains the raw event log. It is useful as a rough activity pulse, but it is not the same as readers, visits, reading time or author performance.

The dashboard now derives more meaningful layers from the raw events:

- raw page views
- unique sessions
- active signed-in users
- public/account/member/admin environment split
- work detail views
- reader opens
- purchase intents
- online unlocks / future downloads

## Page view classification

Each new page view stores:

- `environment`
- `event_type`
- `entity_type`
- `entity_slug`

Examples:

| Path | Environment | Event type | Entity |
| --- | --- | --- | --- |
| `/work/example` | `public` | `work_detail_view` | `work:example` |
| `/reader/example` | `reader` | `reader_open` | `work:example` |
| `/account/library` | `account` | `account_page_view` | account |
| `/member/admin/dashboard` | `admin` | `admin_page_view` | admin |

## Future author transparency

The same event model can later power author dashboards:

- work detail views
- reader opens
- unique sessions per work
- online unlocks
- PDF/EPUB downloads
- purchase interest
- paid purchases
- revenue share / provision calculation

Do not use raw page views alone for author payout. They are too noisy. Payout logic should combine purchase/payment data, entitlement/download events, and agreed author rules.

## Future work

Possible next steps:

- reading heartbeat / active time estimate
- author dashboard
- work-level CSV export
- reader retention cohorts
- download events
- author revenue-share statements
- editor/member contribution analytics
