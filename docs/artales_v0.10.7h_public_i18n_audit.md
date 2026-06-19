ARTales v0.10.7h — public localization audit

Patched in this pass:
- Home page text was rewritten in CZ and EN and now uses cookie locale.
- Public work detail blind spots: source labels, edition metadata labels, ISBN status, not-found state.
- Author detail blind spots: follow status messages, follow panel, writing language label, work-card aria label.
- Work feedback panel is now localized.
- Checkout coming-soon page is now localized.
- Reader footnotes label is now localized in the main reader.

Remaining localization blind spots identified but intentionally not fully patched here:
- Auth/onboarding flows: login, register, forgot-password, reset-password, invite, onboarding still contain many hardcoded EN strings. These should become a separate auth dictionary pass.
- Account settings/security/profile/library pages contain several hardcoded EN strings or partial dictionary coverage. They should become a separate account dictionary pass.
- WorkReaderOverlay still contains hardcoded EN, but current public reader path uses ReaderClient; overlay appears to be legacy/unused or secondary. It can be localized in a cleanup pass if still used.
- Internal member/admin pages are Czech-first and were not normalized to bilingual public dictionaries in this patch.
- Work titles and author/work content fields were deliberately ignored, per instruction.
