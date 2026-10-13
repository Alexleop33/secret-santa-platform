create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null
);

alter table profiles enable row level security;

create policy "profiles: read own row"
on profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "households: admin reads pending referrals"
on households for select
to authenticated
using (
  status = 'pending_review'
  and exists (
    select 1 from profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);
