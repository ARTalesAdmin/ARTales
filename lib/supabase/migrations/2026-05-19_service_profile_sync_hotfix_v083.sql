-- ARTales v0.8.3 – Service-role profile/invite sync hotfix
-- Code-level hotfix: invite acceptance/profile upsert now happens in server actions
-- through SUPABASE_SERVICE_ROLE_KEY. This migration only documents that v0.8.3
-- intentionally keeps existing v0.8.1/v0.8.2 DB helpers as fallback.
--
-- No schema change is required.

select 'ARTales v0.8.3 service profile sync hotfix applied' as note;
