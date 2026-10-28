-- Disposable PostgreSQL 17 fixture; NEVER run against production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE snapshot_ci_admin LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
CREATE ROLE snapshot_ci_editor LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
CREATE ROLE snapshot_ci_outsider LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
CREATE ROLE snapshot_ci_anon LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
GRANT authenticated TO snapshot_ci_admin, snapshot_ci_editor, snapshot_ci_outsider;
GRANT anon TO snapshot_ci_anon;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL, is_active boolean NOT NULL);
CREATE TABLE public.work_candidates (id uuid PRIMARY KEY);
CREATE TABLE public.candidate_legal_sources
  (id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES public.work_candidates(id));
CREATE TABLE public.candidate_legal_decisions
  (decision_no bigint PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES public.work_candidates(id),
   source_id uuid REFERENCES public.candidate_legal_sources(id), verdict text NOT NULL, territory text NOT NULL);
CREATE TABLE public.candidate_legal_locks
  (candidate_id uuid PRIMARY KEY REFERENCES public.work_candidates(id),
   source_id uuid NOT NULL REFERENCES public.candidate_legal_sources(id),
   decision_no bigint NOT NULL UNIQUE REFERENCES public.candidate_legal_decisions(decision_no),
   source_url text NOT NULL, download_url text NOT NULL);
CREATE TABLE storage.objects
  (bucket_id text NOT NULL, name text NOT NULL, owner_id text,
   created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL,
   PRIMARY KEY (bucket_id, name));
GRANT SELECT ON public.profiles, public.candidate_legal_sources,
 public.candidate_legal_decisions, public.candidate_legal_locks TO authenticated;
GRANT SELECT, INSERT ON storage.objects TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_own_profile ON public.profiles FOR SELECT TO authenticated
  USING (id=(SELECT auth.uid()));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY artales_snapshot389_admin_insert_v1 ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='artales-raw-snapshots'
    AND name ~ '^gutenberg/389/sha256/[0-9a-f]{64}/original[.]epub
  USING (bucket_id='artales-raw-snapshots'
    AND name ~ '^gutenberg/389/sha256/[0-9a-f]{64}/original[.]epub$'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.role='admin' AND p.is_active));
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','admin',true),
 ('22222222-2222-4222-8222-222222222222','editor',true),
 ('33333333-3333-4333-8333-333333333333','member',true);
INSERT INTO public.work_candidates VALUES
 ('98508359-bce1-4e73-b842-b69a9d1112d0'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
INSERT INTO public.candidate_legal_sources VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','98508359-bce1-4e73-b842-b69a9d1112d0'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
INSERT INTO public.candidate_legal_decisions VALUES
 (9,'98508359-bce1-4e73-b842-b69a9d1112d0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved','CZ/EU'),
 (11,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','approved','CZ/EU'),
 (12,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','approved','CZ/EU');
INSERT INTO public.candidate_legal_locks VALUES
 ('98508359-bce1-4e73-b842-b69a9d1112d0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',9,
  'https://www.gutenberg.org/ebooks/389','https://www.gutenberg.org/ebooks/389.epub.noimages'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',11,
  'https://www.gutenberg.org/ebooks/11','https://www.gutenberg.org/ebooks/11.epub.noimages'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',12,
  'https://www.gutenberg.org/ebooks/12','https://www.gutenberg.org/ebooks/12.epub.noimages');
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES
 ('artales-raw-snapshots','gutenberg/389/sha256/2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df/original.epub',
  '11111111-1111-4111-8111-111111111111','{"mimetype":"application/epub+zip","size":125934}'::jsonb);

    AND owner_id=(SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.role='admin' AND p.is_active));
CREATE POLICY artales_snapshot389_admin_readback_v1 ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='artales-raw-snapshots'
    AND name ~ '^gutenberg/389/sha256/[0-9a-f]{64}/original[.]epub$'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.role='admin' AND p.is_active));
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','admin',true),
 ('22222222-2222-4222-8222-222222222222','editor',true),
 ('33333333-3333-4333-8333-333333333333','member',true);
INSERT INTO public.work_candidates VALUES
 ('98508359-bce1-4e73-b842-b69a9d1112d0'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
INSERT INTO public.candidate_legal_sources VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','98508359-bce1-4e73-b842-b69a9d1112d0'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
INSERT INTO public.candidate_legal_decisions VALUES
 (9,'98508359-bce1-4e73-b842-b69a9d1112d0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved','CZ/EU'),
 (11,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','approved','CZ/EU'),
 (12,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','approved','CZ/EU');
INSERT INTO public.candidate_legal_locks VALUES
 ('98508359-bce1-4e73-b842-b69a9d1112d0','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',9,
  'https://www.gutenberg.org/ebooks/389','https://www.gutenberg.org/ebooks/389.epub.noimages'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',11,
  'https://www.gutenberg.org/ebooks/11','https://www.gutenberg.org/ebooks/11.epub.noimages'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',12,
  'https://www.gutenberg.org/ebooks/12','https://www.gutenberg.org/ebooks/12.epub.noimages');
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES
 ('artales-raw-snapshots','gutenberg/389/sha256/2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df/original.epub',
  '11111111-1111-4111-8111-111111111111','{"mimetype":"application/epub+zip","size":125934}'::jsonb);
