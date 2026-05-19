-- ARTales v0.8 – Identity / Invites / Member Flow
-- Adds role/preference profile fields, invitations, member submissions and activity log.

alter table public.profiles
  add column if not exists invited_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists invite_id uuid,
  add column if not exists preferred_locale text not null default 'en',
  add column if not exists reader_theme text not null default 'light',
  add column if not exists reader_width text not null default 'normal',
  add column if not exists reader_density text not null default 'comfort',
  add column if not exists reader_font_scale numeric not null default 1,
  add column if not exists reader_controls_collapsed boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'editor', 'member', 'reader'));

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_role text not null check (invited_role in ('editor', 'member', 'reader')),
  token_hash text not null unique,
  invited_by_user_id uuid references auth.users(id) on delete set null,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz,
  accepted_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invites_email_idx on public.invites(email);
create index if not exists invites_invited_by_user_id_idx on public.invites(invited_by_user_id);
create index if not exists invites_status_idx on public.invites(status);

create table if not exists public.member_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by_user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid references public.works(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  type text not null check (type in ('correction', 'image_asset', 'source_note', 'transcription', 'translation_note', 'metadata_suggestion', 'other')),
  title text not null,
  description text not null,
  file_note text,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'accepted', 'rejected', 'needs_changes', 'archived')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_submissions_submitted_by_user_id_idx on public.member_submissions(submitted_by_user_id);
create index if not exists member_submissions_status_idx on public.member_submissions(status);
create index if not exists member_submissions_work_id_idx on public.member_submissions(work_id);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_actor_user_id_idx on public.activity_log(actor_user_id);
create index if not exists activity_log_target_idx on public.activity_log(target_type, target_id);
create index if not exists activity_log_action_idx on public.activity_log(action);

alter table public.invites enable row level security;
alter table public.member_submissions enable row level security;
alter table public.activity_log enable row level security;

-- profiles: allow account creation/upsert for own profile during sign-up/invite acceptance.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

-- Admin/editor invite managers can read/create invites. Public token lookup is allowed only for pending non-expired invites.
drop policy if exists "Invite managers can read invites" on public.invites;
create policy "Invite managers can read invites"
on public.invites
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Pending invites can be read by token" on public.invites;
create policy "Pending invites can be read by token"
on public.invites
for select
to anon, authenticated
using (status = 'pending' and (expires_at is null or expires_at > now()));

drop policy if exists "Invite managers can create invites" on public.invites;
create policy "Invite managers can create invites"
on public.invites
for insert
to authenticated
with check (
  invited_by_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin'
        or (p.role = 'editor' and invited_role in ('member', 'reader'))
      )
  )
);

drop policy if exists "Invite managers and invitees can update invites" on public.invites;
create policy "Invite managers and invitees can update invites"
on public.invites
for update
to authenticated
using (
  accepted_by_user_id = auth.uid()
  or invited_by_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
)
with check (true);

-- Member submissions: submitter sees own; editors/admins see all and review.
drop policy if exists "Members can read own submissions" on public.member_submissions;
create policy "Members can read own submissions"
on public.member_submissions
for select
to authenticated
using (
  submitted_by_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Internal users can create submissions" on public.member_submissions;
create policy "Internal users can create submissions"
on public.member_submissions
for insert
to authenticated
with check (
  submitted_by_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor', 'member')
  )
);

drop policy if exists "Editors can review submissions" on public.member_submissions;
create policy "Editors can review submissions"
on public.member_submissions
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
)
with check (true);

-- Activity log: insert own actions; editors/admins can read all, users can read own actions.
drop policy if exists "Users can insert own activity" on public.activity_log;
create policy "Users can insert own activity"
on public.activity_log
for insert
to authenticated
with check (actor_user_id = auth.uid() or actor_user_id is null);

drop policy if exists "Users can read related activity" on public.activity_log;
create policy "Users can read related activity"
on public.activity_log
for select
to authenticated
using (
  actor_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);
