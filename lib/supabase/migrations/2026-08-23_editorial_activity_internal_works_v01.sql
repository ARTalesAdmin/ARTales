-- ARTales editorial activity and internal works navigation v0.1.
-- Additive only: existing technical works.updated_at semantics remain unchanged.

alter table public.works
  add column if not exists content_changed_at timestamptz null,
  add column if not exists content_changed_by uuid null references public.profiles(id) on delete set null;

create index if not exists works_content_changed_at_idx
  on public.works(content_changed_at desc);

create table if not exists public.work_editor_activity (
  work_id uuid not null references public.works(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_edited_at timestamptz not null default now(),
  last_edited_at timestamptz not null default now(),
  edit_count integer not null default 1 check (edit_count > 0),
  primary key (work_id, user_id)
);

create index if not exists work_editor_activity_user_last_idx
  on public.work_editor_activity(user_id, last_edited_at desc);

alter table public.work_editor_activity enable row level security;

create policy "Editors can read editorial activity"
on public.work_editor_activity for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_active = true and p.role in ('admin', 'editor')
));

create policy "Editors can insert own editorial activity"
on public.work_editor_activity for insert to authenticated
with check (
  user_id = auth.uid() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role in ('admin', 'editor')
  )
);

create policy "Editors can update own editorial activity"
on public.work_editor_activity for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role in ('admin', 'editor')
  )
);

-- One database operation keeps the work timestamp and per-editor activity together.
create or replace function public.record_work_editorial_activity(p_work_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  changed_at timestamptz := now();
begin
  if actor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = actor_id and p.is_active = true and p.role in ('admin', 'editor')
  ) then
    raise exception 'editor_or_admin_required' using errcode = '42501';
  end if;

  update public.works
  set content_changed_at = changed_at, content_changed_by = actor_id
  where id = p_work_id;

  if not found then
    raise exception 'work_not_found' using errcode = 'P0002';
  end if;

  insert into public.work_editor_activity (
    work_id, user_id, first_edited_at, last_edited_at, edit_count
  ) values (p_work_id, actor_id, changed_at, changed_at, 1)
  on conflict (work_id, user_id) do update
  set last_edited_at = excluded.last_edited_at,
      edit_count = public.work_editor_activity.edit_count + 1;
end;
$$;

revoke all on function public.record_work_editorial_activity(uuid) from public;
grant execute on function public.record_work_editorial_activity(uuid) to authenticated;
