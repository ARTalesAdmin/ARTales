-- ARTales Collections v1 seed (core 8 curated collections) — repaired for NOT NULL created_by / updated_by.
-- Run after lib/supabase/migrations/2026-06-19_collections_tags_v0107.sql.
--
-- This picks the first active admin/editor profile as seed owner.
-- If you want a specific owner, replace the seed_user CTE with:
--   select '<AUTH_USER_UUID>'::uuid as id

with seed_user as (
  select id
  from public.profiles
  where is_active = true
    and role in ('admin', 'editor')
  order by case role when 'admin' then 0 else 1 end, created_at asc
  limit 1
),
seed_collections (
    slug,
    title,
    description,
    title_cs,
    title_en,
    subtitle_cs,
    subtitle_en,
    description_cs,
    description_en,
    curator_note_cs,
    curator_note_en,
    collection_type,
    is_featured,
    sort_order,
    is_public_visible
) as (
  values
(
  'shadows-secrets-and-the-unknown',
  'Shadows, Secrets and the Unknown',
  'Tajemné, gotické, temné a psychologicky neklidné texty.',
  'Stíny, tajemství a neznámo',
  'Shadows, Secrets and the Unknown',
  'Gotika, napětí a temná psychologická místa.',
  'Gothic, suspenseful and psychologically uneasy literature.',
  'Kolekce pro gotické romány, horor, temné novely, psychologickou nejistotu a texty, které pracují se stínem, vinou, tajemstvím nebo znepokojením.',
  'A collection for gothic fiction, horror, dark novellas and psychologically uncanny texts shaped by shadow, guilt, secrecy and unease.',
  'Kurátorský okruh pro čtenáře, kteří hledají atmosféru, napětí a literární neklid.',
  'A curated shelf for readers drawn to atmosphere, suspense and literary unease.',
  'curated',
  true,
  10,
  true
),
(
  'adventure-courage-and-the-journey',
  'Adventure, Courage and the Journey',
  'Dobrodružství, výpravy, cesta a rozhodování v pohybu.',
  'Dobrodružství, odvaha a cesta',
  'Adventure, Courage and the Journey',
  'Výpravy, střety a kroky za horizont.',
  'Expeditions, encounters and steps beyond the horizon.',
  'Kolekce pro dobrodružné romány, cestopisné příběhy, průzkumné výpravy, cestu krajinou i cestu charakteru.',
  'A collection for adventure fiction, expeditions, travel narratives and journeys through landscape as well as character.',
  'Nejde jen o akci, ale i o vnitřní pohyb a proměnu během cesty.',
  'Not just action, but inner movement and transformation through the journey itself.',
  'curated',
  true,
  20,
  true
),
(
  'hearts-relationships-and-inner-lives',
  'Hearts, Relationships and Inner Lives',
  'Láska, vztahy, nitro a citová krajina.',
  'Srdce, vztahy a vnitřní život',
  'Hearts, Relationships and Inner Lives',
  'Cit, blízkost, napětí mezi lidmi i uvnitř nich.',
  'Emotion, intimacy and tensions between people and within them.',
  'Kolekce pro romanci, mezilidské drama, intimní prózu a texty soustředěné na city, vazby, touhu a vnitřní konflikty.',
  'A collection for romance, relational drama, intimate prose and texts focused on feeling, attachment, desire and inner conflict.',
  'Vhodné pro texty, kde hlavní dobrodružství probíhá v nitru nebo mezi lidmi.',
  'For works where the main adventure unfolds inside the self or between people.',
  'curated',
  true,
  30,
  true
),
(
  'wonder-imagination-and-the-fantastic',
  'Wonder, Imagination and the Fantastic',
  'Fantazie, podivuhodnost a poetika nemožného.',
  'Úžas, imaginace a fantastično',
  'Wonder, Imagination and the Fantastic',
  'Sny, podivnost, mýty a imaginativní světy.',
  'Dreams, strangeness, myth and imaginative worlds.',
  'Kolekce pro fantasy, pohádku, magický realismus, mytické příběhy a jiné texty pracující s divem, proměnou a fantastičnem.',
  'A collection for fantasy, fairy tale, magical realism, mythic stories and other texts shaped by wonder, transformation and the fantastic.',
  'Sem patří díla, která rozšiřují realitu, nikoli jen unikají z ní.',
  'For works that expand reality rather than merely escape it.',
  'curated',
  true,
  40,
  true
),
(
  'strange-worlds-speculation-and-distant-horizons',
  'Strange Worlds, Speculation and Distant Horizons',
  'Spekulace, jiné světy, technologie a vzdálené obzory.',
  'Podivné světy, spekulace a vzdálené obzory',
  'Strange Worlds, Speculation and Distant Horizons',
  'Sci-fi, alternativy, budoucnosti a jiné možnosti světa.',
  'Science fiction, alternate realities, futures and other possible worlds.',
  'Kolekce pro sci-fi, spekulativní prózu, alternativní světy, technologické otázky a texty, které testují hranice reality a společnosti.',
  'A collection for science fiction, speculative prose, alternate worlds, technological questions and texts that test the limits of reality and society.',
  'Místo pro texty, které se ptají "co kdyby" a berou tuto otázku vážně.',
  'A shelf for works that ask “what if?” and take the question seriously.',
  'curated',
  true,
  50,
  true
),
(
  'mystery-investigation-and-puzzle',
  'Mystery, Investigation and Puzzle',
  'Pátrání, dedukce, hádanka a odhalování.',
  'Záhada, pátrání a hádanka',
  'Mystery, Investigation and Puzzle',
  'Případy, stopy a struktura rozplétání.',
  'Cases, clues and the structure of unraveling.',
  'Kolekce pro detektivku, investigativní fikci, logické hádanky a texty, jejichž tah stojí na odhalování, interpretaci a řešení.',
  'A collection for detective fiction, investigative narratives, logical puzzles and works driven by discovery, interpretation and resolution.',
  'Vhodné pro klasické detektivky i širší příbuzné formy pátrání.',
  'Suitable for classic detective fiction and wider investigative forms.',
  'curated',
  true,
  60,
  true
),
(
  'passion-fate-and-the-price-of-desire',
  'Passion, Fate and the Price of Desire',
  'Touha, osud, pád, vášeň a jejich cena.',
  'Vášeň, osud a cena touhy',
  'Passion, Fate and the Price of Desire',
  'Silné city, tragika, posedlost a nevyhnutelnost.',
  'Strong feeling, tragedy, obsession and inevitability.',
  'Kolekce pro tragické romance, osudové příběhy, destruktivní vášně a texty, v nichž touha vede ke ztrátě, proměně nebo pádu.',
  'A collection for tragic romance, fateful stories, destructive passions and works where desire leads toward loss, transformation or downfall.',
  'Zde je místo pro literaturu s vysokým citovým napětím a osudovým obloukem.',
  'A place for literature of emotional intensity and fateful arcs.',
  'curated',
  false,
  70,
  true
),
(
  'legends-heroes-and-lasting-echoes',
  'Legends, Heroes and Lasting Echoes',
  'Velké příběhy, hrdinské oblouky a ozvěny, které přetrvávají.',
  'Legendy, hrdinové a trvající ozvěny',
  'Legends, Heroes and Lasting Echoes',
  'Epické motivy, mýty, hrdinství a kulturní paměť.',
  'Epic motifs, myth, heroism and cultural memory.',
  'Kolekce pro legendy, eposy, hrdinské příběhy a texty s dlouhým kulturním dozvukem.',
  'A collection for legends, epics, heroic stories and works with a long cultural afterlife.',
  'Kolekce pro texty, které působí jako osa, paměť nebo ozvěna širšího světa.',
  'For works that function as an axis, memory or echo of a wider world.',
  'curated',
  false,
  80,
  true
)
)
insert into public.collections (
  slug,
  title,
  description,
  title_cs,
  title_en,
  subtitle_cs,
  subtitle_en,
  description_cs,
  description_en,
  curator_note_cs,
  curator_note_en,
  collection_type,
  is_featured,
  sort_order,
  is_public_visible,
  created_by,
  updated_by
)
select
  seed_collections.*,
  seed_user.id as created_by,
  seed_user.id as updated_by
from seed_collections
cross join seed_user
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  title_cs = excluded.title_cs,
  title_en = excluded.title_en,
  subtitle_cs = excluded.subtitle_cs,
  subtitle_en = excluded.subtitle_en,
  description_cs = excluded.description_cs,
  description_en = excluded.description_en,
  curator_note_cs = excluded.curator_note_cs,
  curator_note_en = excluded.curator_note_en,
  collection_type = excluded.collection_type,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  is_public_visible = excluded.is_public_visible,
  updated_by = excluded.updated_by,
  updated_at = now();

-- Sanity check:
select slug, title_cs, title_en, is_public_visible, sort_order
from public.collections
where slug in (
  'shadows-secrets-and-the-unknown',
  'adventure-courage-and-the-journey',
  'hearts-relationships-and-inner-lives',
  'wonder-imagination-and-the-fantastic',
  'strange-worlds-speculation-and-distant-horizons',
  'mystery-investigation-and-puzzle',
  'passion-fate-and-the-price-of-desire',
  'legends-heroes-and-lasting-echoes'
)
order by sort_order;
