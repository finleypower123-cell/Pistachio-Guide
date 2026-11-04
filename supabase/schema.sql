-- Pistachio Guide — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query), then set
-- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.

-- 1. Profiles: one row per user, holding preferences, saved places and recently viewed.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  prefs jsonb not null default '{"categories":[],"budget":50,"weatherSmart":true}',
  saved jsonb not null default '[]',
  recent jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- 2. Businesses: a claimed listing. `listing` overrides the public fields of the activity.
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  activity_id text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  plan text not null default 'free' check (plan in ('free','local','featured')),
  featured boolean not null default false,
  listing jsonb not null default '{}',
  offers jsonb not null default '[]',
  photos text[] not null default '{}',
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now(),
  unique (activity_id, owner_id)
);
alter table public.businesses enable row level security;
-- Everyone can read verified listings (so edits show publicly); owners can read their own drafts.
create policy "public reads verified" on public.businesses for select using (status = 'verified' or auth.uid() = owner_id);
create policy "owner inserts" on public.businesses for insert with check (auth.uid() = owner_id);
-- Owners can edit content but not self-verify or self-feature; do that from the dashboard/service role.
create policy "owner updates" on public.businesses for update using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create or replace function public.protect_business_fields() returns trigger language plpgsql as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    new.status := old.status;
    new.plan := old.plan;
    new.featured := old.featured and new.plan = 'featured';
  end if;
  return new;
end $$;
drop trigger if exists businesses_protect on public.businesses;
create trigger businesses_protect before update on public.businesses
  for each row execute function public.protect_business_fields();

-- 3. Listing analytics: anonymous events (view, save, booking_click, website_click).
create table if not exists public.listing_events (
  id bigint generated always as identity primary key,
  activity_id text not null,
  kind text not null check (kind in ('view','save','booking_click','website_click','directions')),
  created_at timestamptz not null default now()
);
create index if not exists listing_events_activity_idx on public.listing_events (activity_id, created_at);
alter table public.listing_events enable row level security;
create policy "anyone logs events" on public.listing_events for insert with check (true);
create policy "owners read their events" on public.listing_events for select using (
  exists (select 1 from public.businesses b where b.activity_id = listing_events.activity_id and b.owner_id = auth.uid())
);

-- 4. Photo storage bucket for business uploads.
insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', true)
  on conflict (id) do nothing;
create policy "public photo read" on storage.objects for select using (bucket_id = 'listing-photos');
create policy "owners upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
