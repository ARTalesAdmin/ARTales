create table if not exists public.reader_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_slug text not null,
  mode text,
  progress_percent double precision not null check (progress_percent between 0 and 100),
  scroll_y double precision not null,
  page_index integer check (page_index is null or page_index >= 0),
  page_count integer check (page_count is null or page_count >= 0),
  layout_mode text check (layout_mode is null or layout_mode in ('pagedFlow', 'spread', 'scroll', 'page')),
  updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, work_slug)
);

alter table public.reader_progress enable row level security;

-- Make latest-wins atomic even when two devices write between the API's
-- defensive read and upsert. A stale update becomes a no-op.
create or replace function public.keep_newer_reader_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.keep_newer_reader_progress() from public;

create trigger reader_progress_keep_newer
  before update on public.reader_progress
  for each row execute function public.keep_newer_reader_progress();

create policy "reader_progress_select_own" on public.reader_progress
  for select using (auth.uid() = user_id);
create policy "reader_progress_insert_own" on public.reader_progress
  for insert with check (auth.uid() = user_id);
create policy "reader_progress_update_own" on public.reader_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reader_progress_delete_own" on public.reader_progress
  for delete using (auth.uid() = user_id);

revoke all on table public.reader_progress from anon;
grant select, insert, update, delete on table public.reader_progress to authenticated;
