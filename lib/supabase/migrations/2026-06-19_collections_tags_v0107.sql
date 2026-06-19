-- ARTales v0.10.7 — Collections & Tags v1.0
-- Collections become bilingual curated galleries. Tags are introduced as typed metadata.
-- A many-to-many bridge is added for collection membership and work tags.

alter table public.collections
  add column if not exists title_cs text,
  add column if not exists title_en text,
  add column if not exists subtitle_cs text,
  add column if not exists subtitle_en text,
  add column if not exists description_cs text,
  add column if not exists description_en text,
  add column if not exists curator_note_cs text,
  add column if not exists curator_note_en text,
  add column if not exists collection_type text not null default 'curated',
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_order integer not null default 100;

alter table public.collections
  drop constraint if exists collections_collection_type_check;

alter table public.collections
  add constraint collections_collection_type_check
  check (collection_type in ('curated', 'seasonal', 'authorial', 'editorial', 'school_library', 'community'));

update public.collections
set
  title_cs = coalesce(nullif(title_cs, ''), nullif(title, '')),
  title_en = coalesce(nullif(title_en, ''), nullif(title, '')),
  description_cs = coalesce(nullif(description_cs, ''), nullif(description, '')),
  description_en = coalesce(nullif(description_en, ''), nullif(description, '')),
  sort_order = coalesce(sort_order, 100),
  collection_type = coalesce(collection_type, 'curated');

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_cs text not null,
  label_en text,
  description_cs text,
  description_en text,
  type text not null default 'other',
  canonical_tag_id uuid references public.tags(id) on delete set null,
  is_public_visible boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tags
  drop constraint if exists tags_type_check;

alter table public.tags
  add constraint tags_type_check
  check (type in ('genre', 'form', 'theme', 'mood', 'period', 'language', 'difficulty', 'reading_mode', 'format', 'audience', 'content_note', 'other'));

create index if not exists tags_type_idx on public.tags(type);
create index if not exists tags_is_public_visible_idx on public.tags(is_public_visible);
create index if not exists tags_sort_order_idx on public.tags(sort_order, label_cs);

create table if not exists public.work_collections (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  sort_order integer not null default 100,
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, collection_id)
);

create index if not exists work_collections_collection_idx on public.work_collections(collection_id, sort_order);
create index if not exists work_collections_work_idx on public.work_collections(work_id, sort_order);

create table if not exists public.work_tags (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, tag_id)
);

create index if not exists work_tags_work_idx on public.work_tags(work_id, sort_order);
create index if not exists work_tags_tag_idx on public.work_tags(tag_id, sort_order);

insert into public.work_collections (work_id, collection_id, sort_order, is_primary)
select w.id, w.collection_id, 100, true
from public.works w
where w.collection_id is not null
on conflict (work_id, collection_id)
do update set is_primary = true;

alter table public.tags enable row level security;
alter table public.work_tags enable row level security;
alter table public.work_collections enable row level security;

-- Tags policies

drop policy if exists "Public can read visible tags" on public.tags;
create policy "Public can read visible tags"
on public.tags
for select
to anon, authenticated
using (
  is_public_visible = true
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Editors manage tags" on public.tags;
create policy "Editors manage tags"
on public.tags
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

-- work_tags policies

drop policy if exists "Public can read tags of published works" on public.work_tags;
create policy "Public can read tags of published works"
on public.work_tags
for select
to anon, authenticated
using (
  exists (
    select 1 from public.works w
    where w.id = work_id
      and (
        w.status = 'published'
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.is_active = true
            and p.role in ('admin', 'editor')
        )
      )
  )
);

drop policy if exists "Editors manage work tags" on public.work_tags;
create policy "Editors manage work tags"
on public.work_tags
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

-- work_collections policies

drop policy if exists "Public can read collections of published works" on public.work_collections;
create policy "Public can read collections of published works"
on public.work_collections
for select
to anon, authenticated
using (
  exists (
    select 1 from public.works w
    where w.id = work_id
      and (
        w.status = 'published'
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.is_active = true
            and p.role in ('admin', 'editor')
        )
      )
  )
);

drop policy if exists "Editors manage work collections" on public.work_collections;
create policy "Editors manage work collections"
on public.work_collections
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);
