-- Card Manager: initial schema.
-- Conventions: RLS on every table, explicit grants (no reliance on default privileges),
-- `(select auth.uid())` so Postgres evaluates the uid once per statement instead of per row.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger so the client never inserts.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- security definer is required to write into public.profiles from the auth schema trigger;
-- empty search_path prevents object shadowing attacks.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

create policy "profiles: owner can read"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles: owner can update"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- collection_items
-- ---------------------------------------------------------------------------
create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- text + check instead of an enum: adding a game is a constraint swap, not a type migration.
  tcg text not null default 'pokemon' check (tcg in ('pokemon')),
  card_id text not null check (card_id ~ '^[A-Za-z0-9_.!?-]{1,64}$'),
  quantity integer not null default 1 check (quantity between 1 and 9999),
  condition text not null check (condition in ('NM', 'EX', 'GD', 'PL')),
  variant text not null check (variant in ('normal', 'reverse', 'holo')),
  -- Denormalised card snapshot: renders the collection (and its offline copy) without one API
  -- call per item. Card metadata is immutable once a set is released.
  card_name text not null check (char_length(card_name) between 1 and 120),
  set_id text not null check (set_id ~ '^[A-Za-z0-9_.!?-]{1,64}$'),
  set_name text not null check (char_length(set_name) between 1 and 120),
  local_id text not null check (char_length(local_id) between 1 and 20),
  image_url text check (image_url is null or image_url like 'https://assets.tcgdex.net/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Duplicate detection: one row per (user, card, condition, variant); its btree index also
  -- serves every "my collection" query through the user_id prefix.
  constraint collection_items_unique_entry unique (user_id, tcg, card_id, condition, variant)
);

create trigger collection_items_set_updated_at
before update on public.collection_items
for each row execute function public.set_updated_at();

alter table public.collection_items enable row level security;
revoke all on table public.collection_items from anon, authenticated;
grant select, insert, update, delete on table public.collection_items to authenticated;

create policy "collection_items: owner can read"
on public.collection_items for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "collection_items: owner can insert"
on public.collection_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "collection_items: owner can update"
on public.collection_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "collection_items: owner can delete"
on public.collection_items for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Atomic "add or increment": avoids the read-then-write race of two devices adding the same
-- card at once. security invoker keeps RLS in force.
create or replace function public.add_collection_item(
  p_card_id text,
  p_condition text,
  p_variant text,
  p_quantity integer,
  p_card_name text,
  p_set_id text,
  p_set_name text,
  p_local_id text,
  p_image_url text,
  p_tcg text default 'pokemon'
)
returns public.collection_items
language sql
security invoker
set search_path = ''
as $$
  insert into public.collection_items as ci (
    user_id, tcg, card_id, condition, variant, quantity,
    card_name, set_id, set_name, local_id, image_url
  )
  values (
    auth.uid(), p_tcg, p_card_id, p_condition, p_variant, p_quantity,
    p_card_name, p_set_id, p_set_name, p_local_id, p_image_url
  )
  on conflict on constraint collection_items_unique_entry
  do update set quantity = least(ci.quantity + excluded.quantity, 9999)
  returning ci.*;
$$;

revoke execute on function public.add_collection_item(
  text, text, text, integer, text, text, text, text, text, text
) from public, anon;
grant execute on function public.add_collection_item(
  text, text, text, integer, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- card_prices: shared cache written only by the `card-prices` Edge Function (secret key,
-- bypasses RLS). Clients may read it but never write it.
-- ---------------------------------------------------------------------------
create table public.card_prices (
  tcg text not null default 'pokemon' check (tcg in ('pokemon')),
  card_id text not null check (card_id ~ '^[A-Za-z0-9_.!?-]{1,64}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Prices for the standard print. All-null row = "source has no price": cached too, so unknown
  -- cards do not trigger an upstream call on every request.
  low numeric(12, 2) check (low is null or low >= 0),
  mid numeric(12, 2) check (mid is null or mid >= 0),
  market numeric(12, 2) check (market is null or market >= 0),
  -- Reverse/holo prints trade at a different price on Cardmarket.
  holo_low numeric(12, 2) check (holo_low is null or holo_low >= 0),
  holo_mid numeric(12, 2) check (holo_mid is null or holo_mid >= 0),
  holo_market numeric(12, 2) check (holo_market is null or holo_market >= 0),
  source text not null check (char_length(source) between 1 and 40),
  updated_at timestamptz not null default now(),
  primary key (tcg, card_id, currency)
);

alter table public.card_prices enable row level security;
revoke all on table public.card_prices from anon, authenticated;
grant select on table public.card_prices to authenticated;

create policy "card_prices: authenticated can read"
on public.card_prices for select
to authenticated
using (true);
