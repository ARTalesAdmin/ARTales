-- ARTales v0.10.12j
-- Staging table for large work content blocks.
-- This avoids rewriting the entire works.content_blocks JSON payload when an editor appends
-- thousands of blocks to a long work.

create table if not exists public.work_content_block_batches (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  blocks jsonb not null default '[]'::jsonb,
  block_count integer generated always as (jsonb_array_length(blocks)) stored,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint work_content_block_batches_blocks_array_check check (jsonb_typeof(blocks) = 'array')
);

create index if not exists work_content_block_batches_work_created_idx
  on public.work_content_block_batches(work_id, created_at, id);

alter table public.work_content_block_batches enable row level security;

drop policy if exists "Editors can read work content block batches" on public.work_content_block_batches;
create policy "Editors can read work content block batches"
on public.work_content_block_batches
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Editors can insert work content block batches" on public.work_content_block_batches;
create policy "Editors can insert work content block batches"
on public.work_content_block_batches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Editors can update work content block batches" on public.work_content_block_batches;
create policy "Editors can update work content block batches"
on public.work_content_block_batches
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);

drop policy if exists "Editors can delete work content block batches" on public.work_content_block_batches;
create policy "Editors can delete work content block batches"
on public.work_content_block_batches
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'editor')
  )
);
