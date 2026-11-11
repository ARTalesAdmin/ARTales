-- Disposable, LOCAL ONLY PostgreSQL fixture. Never run on production.
-- Tests LIVE application RPC SQL pulled from migrations, not mocked variants.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE golden_ci_editor LOGIN PASSWORD 'ci-actor-only' NOBYPASSRLS;
GRANT authenticated TO golden_ci_editor;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth, public, storage TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL,is_active boolean NOT NULL);
CREATE TABLE public.work_candidates(id uuid PRIMARY KEY,proposed_author_name text NOT NULL);
CREATE TABLE public.authors(
 id uuid PRIMARY KEY,name text NOT NULL,name_en text,
 bio_cs text,bio_en text,portrait_image_path text,portrait_image_alt text
);
CREATE TABLE public.collections(id uuid PRIMARY KEY,description_cs text,description_en text);
CREATE TABLE public.artales_editorial_tasks(
 id uuid PRIMARY KEY,candidate_id uuid NOT NULL,
 kind text NOT NULL,status text NOT NULL,assigned_to uuid
);
CREATE TABLE public.artales_candidate_editorial_metadata(
 candidate_id uuid PRIMARY KEY,author_id uuid,collection_id uuid,
 work_description text,work_description_cs text,work_description_en text,
 cover_image_path text,cover_image_alt text,cover_image_caption text,
 updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE storage.objects(bucket_id text NOT NULL,name text NOT NULL, PRIMARY KEY(bucket_id,name));
GRANT SELECT ON public.profiles,public.work_candidates,public.artales_editorial_tasks,
 public.authors,public.collections,public.artales_candidate_editorial_metadata,
 storage.objects TO authenticated;
-- Real test actor, two synthetic candidates, two assigned tasks. Zero live IDs.
INSERT INTO public.profiles VALUES
('7e57a1e5-7e57-4ae5-8ae5-7e57a1e50003','editor',true);
INSERT INTO public.work_candidates VALUES
('7e57a1e5-7e57-4ae5-8ae5-7e57a1e50001','Mark Twain'),
('7e57a1e5-7e57-4ae5-8ae5-7e57a1e50011','Sheridan Le Fanu');
INSERT INTO public.artales_editorial_tasks VALUES
('7e57a1e5-7e57-4ae5-8ae5-7e57a1e50004','7e57a1e5-7e57-4ae5-8ae5-7e57a1e50001',
 'cover_art','claimed','7e57a1e5-7e57-4ae5-8ae5-7e57a1e50003'),
('7e57a1e5-7e57-4ae5-8ae5-7e57a1e50014','7e57a1e5-7e57-4ae5-8ae5-7e57a1e50011',
 'author_bio','claimed','7e57a1e5-7e57-4ae5-8ae5-7e57a1e50003');
INSERT INTO public.authors VALUES
('7e57a1e5-7e57-4ae5-8ae5-7e57a1e50012','Joseph Sheridan Le Fanu',
 'Joseph Sheridan Le Fanu',repeat('Česká biografie autora. ',14),
 repeat('English biography of author. ',11),NULL,NULL);
INSERT INTO storage.objects VALUES
('artales-images','works/7e57a1e5-7e57-4ae5-8ae5-7e57a1e50001/cover/cover-synthetic.png');
