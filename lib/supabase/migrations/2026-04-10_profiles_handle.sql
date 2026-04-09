alter table public.profiles
add column handle text;

create unique index profiles_handle_unique_idx
on public.profiles (handle)
where handle is not null;

alter table public.profiles
add constraint profiles_handle_format_check
check (
  handle is null
  or (
    btrim(handle) <> ''
    and handle = lower(handle)
    and handle !~ '\s'
    and handle ~ '^[a-z0-9_-]+$'
    and char_length(handle) between 3 and 32
  )
);