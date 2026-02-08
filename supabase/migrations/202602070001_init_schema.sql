create extension if not exists "pgcrypto";

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  instagram_handle text not null unique,
  full_name text,
  business_type text,
  city text,
  country text,
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_instagram_handle_not_blank check (length(trim(instagram_handle)) > 0)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'contacted', 'replied', 'qualified', 'disqualified')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_workspace_profile_unique unique (workspace_id, profile_id)
);

create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  filters jsonb,
  results_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_workspace_id on public.leads (workspace_id);
create index if not exists idx_leads_owner_id on public.leads (owner_id);
create index if not exists idx_search_runs_workspace_id on public.search_runs (workspace_id);
create index if not exists idx_search_runs_owner_id on public.search_runs (owner_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row
execute procedure public.set_updated_at();
