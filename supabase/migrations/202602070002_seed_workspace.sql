insert into public.workspaces (name)
values ('Harbiz')
on conflict (name) do nothing;
