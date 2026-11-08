-- Automatic Compose creates a revision and its editorial tasks atomically.
-- The previous RLS INSERT policy checked the assigned editor through
-- public.profiles, whose SELECT policy reveals only the requester's own row.
-- Consequently, an active admin could not create tasks for other active
-- editors and the whole semantic revision transaction was rolled back.
--
-- This private, non-Data-API helper answers only whether a staff assignee is
-- eligible. It never returns a profile or expands profile SELECT visibility.
CREATE SCHEMA IF NOT EXISTS artales_private;
REVOKE ALL ON SCHEMA artales_private FROM PUBLIC;
GRANT USAGE ON SCHEMA artales_private TO authenticated;

CREATE FUNCTION artales_private.is_assignable_editorial_profile(p_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $body$
 SELECT (SELECT auth.uid()) IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.profiles actor
      WHERE actor.id=(SELECT auth.uid()) AND actor.is_active
       AND actor.role::text='admin'
   )
   AND EXISTS (
     SELECT 1 FROM public.profiles assignee
      WHERE assignee.id=p_profile_id AND assignee.is_active
       AND assignee.role::text IN ('admin','editor')
   );
$body$;

REVOKE ALL ON FUNCTION artales_private.is_assignable_editorial_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artales_private.is_assignable_editorial_profile(uuid) TO authenticated;

-- Keep every original gate: current active admin identity, exact created_by,
-- open status, and a referenced semantic revision. Only the assignee check
-- changes from an RLS-hidden profile lookup to the restricted boolean helper.
ALTER POLICY task_admin_insert ON public.artales_editorial_tasks
 WITH CHECK (
   created_by=(SELECT auth.uid())
   AND status='open'
   AND EXISTS (
     SELECT 1 FROM public.profiles actor
      WHERE actor.id=(SELECT auth.uid()) AND actor.is_active
       AND actor.role::text='admin'
   )
   AND (
     assigned_to IS NULL
     OR (SELECT artales_private.is_assignable_editorial_profile(assigned_to))
   )
   AND EXISTS (
     SELECT 1 FROM public.candidate_semantic_revisions revision
      WHERE revision.candidate_id=artales_editorial_tasks.candidate_id
       AND revision.revision_sha256=artales_editorial_tasks.revision_sha256
   )
 );
