-- ARTales Work-Scoped Submission Routing v0.1.
-- Responsibility is explicit; submission routing is an immutable creation-time snapshot.

alter table public.works
  add column if not exists responsible_editor_id uuid null
  references public.profiles(id) on delete restrict;

alter table public.member_submissions
  add column if not exists target_editor_user_id uuid null
  references public.profiles(id) on delete restrict;

-- RESTRICT deliberately preserves identity meaning. In particular, deleting a profile
-- must not silently turn a historically targeted submission into a general submission.

create index if not exists works_responsible_editor_id_idx
  on public.works(responsible_editor_id) where responsible_editor_id is not null;
create index if not exists member_submissions_target_editor_user_id_idx
  on public.member_submissions(target_editor_user_id) where target_editor_user_id is not null;

-- A SECURITY DEFINER RPC avoids broad profile SELECT access and returns only safe identity fields.
create or replace function public.list_submission_recipient_options()
returns table(id uuid, display_name text, handle text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.handle
  from public.profiles p
  where auth.uid() is not null
    and exists (
      select 1 from public.profiles caller
      where caller.id = auth.uid() and caller.is_active = true
        and caller.role in ('admin', 'editor', 'member')
    )
    and p.is_active = true
    and p.role in ('admin', 'editor')
  order by p.display_name, p.handle;
$$;

revoke all on function public.list_submission_recipient_options() from public;
grant execute on function public.list_submission_recipient_options() to authenticated;

create or replace function public.validate_submission_routing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.target_editor_user_id is distinct from old.target_editor_user_id then
    raise exception 'submission_target_is_immutable' using errcode = '23514';
  end if;

  if new.target_editor_user_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.target_editor_user_id and p.is_active = true
      and p.role in ('admin', 'editor')
  ) then
    raise exception 'invalid_submission_target' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_submission_routing on public.member_submissions;
create trigger validate_submission_routing
before insert or update on public.member_submissions
for each row execute function public.validate_submission_routing();

create or replace function public.validate_work_responsibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles caller
    where caller.id = auth.uid() and caller.is_active = true
      and caller.role in ('admin', 'editor')
  ) then
    raise exception 'editor_or_admin_required' using errcode = '42501';
  end if;

  if new.responsible_editor_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.responsible_editor_id and p.is_active = true
      and p.role in ('admin', 'editor')
  ) then
    raise exception 'invalid_responsible_editor' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_work_responsibility on public.works;
create trigger validate_work_responsibility
before insert or update of responsible_editor_id on public.works
for each row execute function public.validate_work_responsibility();

-- Submitters retain access to their own rows. Admins see all; editors see general
-- submissions plus rows routed specifically to them.
drop policy if exists "Members can read own submissions" on public.member_submissions;
drop policy if exists "Members can read routed submissions" on public.member_submissions;
create policy "Members can read routed submissions"
on public.member_submissions for select to authenticated
using (
  submitted_by_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
      and (
        p.role = 'admin'
        or (p.role = 'editor' and (
          target_editor_user_id is null or target_editor_user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists "Editors can review submissions" on public.member_submissions;
drop policy if exists "Editors can review routed submissions" on public.member_submissions;
create policy "Editors can review routed submissions"
on public.member_submissions for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
      and (
        p.role = 'admin'
        or (p.role = 'editor' and (
          target_editor_user_id is null or target_editor_user_id = auth.uid()
        ))
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
      and (
        p.role = 'admin'
        or (p.role = 'editor' and (
          target_editor_user_id is null or target_editor_user_id = auth.uid()
        ))
      )
  )
);
