-- Test-only synthetic editor invitation. Never execute on linked/cloud Supabase.
-- psql -v invite_email=<synthetic email> -f this file
insert into public.invites(email,invited_role,token_hash,status,expires_at)
values (lower(:'invite_email'),'editor','local-ci-token-not-sent','pending',now()+interval '1 day')
returning id;
