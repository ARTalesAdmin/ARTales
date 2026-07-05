-- ARTales v0.10.13b-hotfix2
-- Allow the public reader to load staged/batched blocks for published works.
-- Editors keep their existing authenticated read/write policies.

grant select on public.work_content_block_batches to anon, authenticated;
grant insert, update, delete on public.work_content_block_batches to authenticated;

drop policy if exists "Public can read published work content block batches" on public.work_content_block_batches;
create policy "Public can read published work content block batches"
on public.work_content_block_batches
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.works w
    where w.id = work_content_block_batches.work_id
      and w.status = 'published'
  )
);
