create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'sdr' check (role in ('owner', 'admin', 'sdr')),
  created_at timestamptz not null default now(),
  constraint workspace_members_user_workspace_unique unique (user_id, workspace_id)
);

create index if not exists idx_workspace_members_workspace_id on public.workspace_members (workspace_id);
create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);

alter table public.leads add column if not exists source_query text;
alter table public.leads add column if not exists confidence numeric(5,2);
alter table public.leads add column if not exists discovered_at timestamptz not null default now();
