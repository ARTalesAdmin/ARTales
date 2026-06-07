-- ARTales v0.9.6b – Analytics refinement & KPI foundation
-- Extends raw page view tracking with classified event fields for future dashboards,
-- author analytics and revenue-share reporting.

alter table public.page_views
  add column if not exists environment text,
  add column if not exists event_type text,
  add column if not exists entity_type text,
  add column if not exists entity_slug text;

create index if not exists page_views_environment_idx
  on public.page_views(environment, created_at desc);

create index if not exists page_views_event_type_idx
  on public.page_views(event_type, created_at desc);

create index if not exists page_views_entity_idx
  on public.page_views(entity_type, entity_slug, created_at desc);

create index if not exists page_views_session_idx
  on public.page_views(session_id, created_at desc);

-- Backfill a useful first approximation for existing rows.
update public.page_views
set
  environment = case
    when path like '/member/admin%' then 'admin'
    when path like '/member%' then 'member'
    when path like '/account%' then 'account'
    when path like '/checkout%' then 'checkout'
    when path like '/reader/%' then 'reader'
    when path like '/login%' or path like '/register%' or path like '/forgot-password%' or path like '/reset-password%' or path like '/auth%' then 'auth'
    else 'public'
  end,
  event_type = case
    when path like '/member/admin%' then 'admin_page_view'
    when path like '/member%' then 'member_page_view'
    when path like '/account%' then 'account_page_view'
    when path like '/checkout%' then 'checkout_page_view'
    when path like '/reader/%' then 'reader_open'
    when path like '/work/%' then 'work_detail_view'
    when path like '/login%' or path like '/register%' or path like '/forgot-password%' or path like '/reset-password%' or path like '/auth%' then 'auth_page_view'
    else 'page_view'
  end,
  entity_type = case
    when path like '/reader/%' or path like '/work/%' then 'work'
    when path like '/author/%' then 'author'
    when path like '/collections/%' then 'collection'
    else null
  end,
  entity_slug = case
    when path like '/reader/%' then split_part(split_part(path, '?', 1), '/', 3)
    when path like '/work/%' then split_part(split_part(path, '?', 1), '/', 3)
    when path like '/author/%' then split_part(split_part(path, '?', 1), '/', 3)
    when path like '/collections/%' then split_part(split_part(path, '?', 1), '/', 3)
    else null
  end
where environment is null or event_type is null;
