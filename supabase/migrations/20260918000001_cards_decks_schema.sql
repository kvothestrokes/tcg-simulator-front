-- Migration: cards_decks_schema
-- Creates the cards catalog, decks, and deck_cards tables with RLS policies.
--
-- NOTE on UUID generation (Task 1.4):
--   gen_random_uuid() is available on Supabase projects running PostgreSQL 13+
--   with the pgcrypto extension (enabled by default on all Supabase projects).
--   If it is unavailable, replace gen_random_uuid() with uuid_generate_v4()
--   after enabling the uuid-ossp extension:
--     CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────────────
-- cards: read-only public catalog (admin-seeded, no owner column)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.cards (
  id        text        primary key,
  nombre    text        not null,
  tipo      text        not null,
  faccion   text        not null,
  rareza    text        not null,
  data      jsonb       not null,
  created_at timestamptz not null default now()
);

create index if not exists cards_tipo_idx    on public.cards (tipo);
create index if not exists cards_faccion_idx on public.cards (faccion);

-- ────────────────────────────────────────────────────────────────────────────
-- decks: owner-scoped
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.decks (
  id         uuid        primary key default gen_random_uuid(),
  -- gen_random_uuid() fallback: uuid_generate_v4() (requires uuid-ossp extension)
  owner      uuid        not null default auth.uid(),
  nombre     text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_owner_idx on public.decks (owner);

-- ────────────────────────────────────────────────────────────────────────────
-- deck_cards: join table (deck_id × card_id with qty)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.deck_cards (
  deck_id uuid not null references public.decks (id) on delete cascade,
  card_id text not null references public.cards (id) on delete restrict,
  qty     int  not null check (qty >= 1),
  primary key (deck_id, card_id)
);

create index if not exists deck_cards_card_idx on public.deck_cards (card_id);

-- ────────────────────────────────────────────────────────────────────────────
-- updated_at trigger for decks
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────────────────────────────────────
alter table public.cards     enable row level security;
alter table public.decks     enable row level security;
alter table public.deck_cards enable row level security;

-- cards: public SELECT only — no INSERT/UPDATE/DELETE for non-service-role
create policy cards_public_select
  on public.cards for select
  using (true);

-- decks: owner-only CRUD
-- Anonymous users share the `authenticated` role and have a real auth.uid(),
-- so they are treated identically to magic-link users by these policies.
create policy decks_select
  on public.decks for select
  using (auth.uid() = owner);

create policy decks_insert
  on public.decks for insert
  with check (auth.uid() = owner);

create policy decks_update
  on public.decks for update
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

create policy decks_delete
  on public.decks for delete
  using (auth.uid() = owner);

-- deck_cards: access is gated through parent deck ownership (EXISTS join)
-- This prevents User B from reading or mutating User A's deck_cards rows
-- even when User B knows the deck_id.
create policy deck_cards_select
  on public.deck_cards for select
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.owner = auth.uid()
    )
  );

create policy deck_cards_insert
  on public.deck_cards for insert
  with check (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.owner = auth.uid()
    )
  );

create policy deck_cards_update
  on public.deck_cards for update
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.owner = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.owner = auth.uid()
    )
  );

create policy deck_cards_delete
  on public.deck_cards for delete
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_id and d.owner = auth.uid()
    )
  );
