-- ARTales v0.9.7d - Locale, Follow Management & Feedback Triage
-- Safe rebuild patch for the unfinished v0.9.7d scope.

alter table public.work_feedback
  add column if not exists acknowledged_at timestamptz;

alter table public.work_feedback
  add column if not exists acknowledged_by_user_id uuid references public.profiles(id) on delete set null;

alter table public.work_feedback
  alter column status set default 'new';

update public.work_feedback
set status = 'acknowledged',
    acknowledged_at = coalesce(acknowledged_at, updated_at, created_at)
where status in ('reviewed', 'accepted', 'archived');

alter table public.work_feedback
  drop constraint if exists work_feedback_status_check;

alter table public.work_feedback
  add constraint work_feedback_status_check
  check (status in ('new', 'acknowledged'));

create index if not exists idx_work_feedback_acknowledged_at
  on public.work_feedback(acknowledged_at desc);

create index if not exists idx_work_feedback_acknowledged_by_user_id
  on public.work_feedback(acknowledged_by_user_id);
