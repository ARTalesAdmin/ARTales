-- ARTales v0.9.7 - Localization & Community Foundation

create table if not exists public.author_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  notification_level text not null default 'new_releases' check (notification_level in ('new_releases', 'all_updates', 'silent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, author_id)
);

create index if not exists idx_author_follows_user_id on public.author_follows(user_id);
create index if not exists idx_author_follows_author_id on public.author_follows(author_id);

create table if not exists public.work_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  work_id uuid not null references public.works(id) on delete cascade,
  feedback_type text not null default 'general' check (feedback_type in ('general', 'correction', 'translation', 'formatting', 'rights', 'comment')),
  body text not null check (char_length(trim(body)) between 3 and 4000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'accepted', 'archived')),
  visibility text not null default 'editorial' check (visibility in ('editorial', 'author_candidate', 'public_candidate')),
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_feedback_work_id on public.work_feedback(work_id);
create index if not exists idx_work_feedback_user_id on public.work_feedback(user_id);
create index if not exists idx_work_feedback_status on public.work_feedback(status);
create index if not exists idx_work_feedback_created_at on public.work_feedback(created_at desc);

create table if not exists public.localization_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  work_id uuid references public.works(id) on delete cascade,
  requested_locale text not null check (requested_locale in ('en', 'cs')),
  request_type text not null default 'translation' check (request_type in ('translation', 'validation', 'proofread')),
  note text,
  status text not null default 'new' check (status in ('new', 'planned', 'in_progress', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_localization_requests_work_id on public.localization_requests(work_id);
create index if not exists idx_localization_requests_status on public.localization_requests(status);

alter table public.author_follows enable row level security;
alter table public.work_feedback enable row level security;
alter table public.localization_requests enable row level security;

drop policy if exists "Users can view their author follows" on public.author_follows;
create policy "Users can view their author follows"
  on public.author_follows
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their author follows" on public.author_follows;
create policy "Users can insert their author follows"
  on public.author_follows
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their author follows" on public.author_follows;
create policy "Users can delete their author follows"
  on public.author_follows
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view their feedback" on public.work_feedback;
create policy "Users can view their feedback"
  on public.work_feedback
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their feedback" on public.work_feedback;
create policy "Users can insert their feedback"
  on public.work_feedback
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their localization requests" on public.localization_requests;
create policy "Users can view their localization requests"
  on public.localization_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their localization requests" on public.localization_requests;
create policy "Users can insert their localization requests"
  on public.localization_requests
  for insert
  with check (auth.uid() = user_id);
