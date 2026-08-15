-- Reader Phase 4: private, account-synchronised notes.
create table if not exists public.reader_notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_slug text not null,
  title text,
  body text,
  color text not null default 'gold' check (color in ('gold', 'blue', 'green', 'rose', 'violet')),
  progress_percent double precision not null default 0 check (progress_percent between 0 and 100),
  scroll_y double precision not null default 0,
  page_index integer,
  page_count integer,
  layout_mode text check (layout_mode in ('pagedFlow', 'spread', 'scroll', 'page')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reader_notes_user_work_updated
  on public.reader_notes(user_id, work_slug, updated_at desc);

alter table public.reader_notes enable row level security;

create policy "reader_notes_select_own" on public.reader_notes for select
  using (auth.uid() = user_id);
create policy "reader_notes_insert_own" on public.reader_notes for insert
  with check (auth.uid() = user_id);
create policy "reader_notes_update_own" on public.reader_notes for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reader_notes_delete_own" on public.reader_notes for delete
  using (auth.uid() = user_id);
