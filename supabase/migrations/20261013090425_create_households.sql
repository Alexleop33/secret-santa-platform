create table households (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  summary text not null,
  status text not null default 'pending_review',
  referred_on timestamptz not null
);

alter table households enable row level security;
