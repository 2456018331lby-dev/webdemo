alter table public.profiles enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.rooms enable row level security;
alter table public.devices enable row level security;
alter table public.device_modules enable row level security;
alter table public.device_state enable row level security;
alter table public.device_commands enable row level security;
alter table public.telemetry_events enable row level security;
alter table public.provisioning_sessions enable row level security;
alter table public.firmware_versions enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_home_member(target_home_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.home_members hm
    where hm.home_id = target_home_id
      and hm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_home_admin(target_home_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.home_members hm
    where hm.home_id = target_home_id
      and hm.profile_id = auth.uid()
      and hm.role in ('owner', 'installer', 'admin')
  );
$$;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "homes member read" on public.homes;
create policy "homes member read"
on public.homes
for select
to authenticated
using (public.is_home_member(id));

drop policy if exists "home members member read" on public.home_members;
create policy "home members member read"
on public.home_members
for select
to authenticated
using (public.is_home_member(home_id));

drop policy if exists "rooms member read" on public.rooms;
create policy "rooms member read"
on public.rooms
for select
to authenticated
using (public.is_home_member(home_id));

drop policy if exists "devices member read" on public.devices;
create policy "devices member read"
on public.devices
for select
to authenticated
using (public.is_home_member(home_id));

drop policy if exists "device modules member read" on public.device_modules;
create policy "device modules member read"
on public.device_modules
for select
to authenticated
using (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and public.is_home_member(d.home_id)
  )
);

drop policy if exists "device state member read" on public.device_state;
create policy "device state member read"
on public.device_state
for select
to authenticated
using (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and public.is_home_member(d.home_id)
  )
);

drop policy if exists "device state member update" on public.device_state;
create policy "device state member update"
on public.device_state
for update
to authenticated
using (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and public.is_home_member(d.home_id)
  )
)
with check (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and public.is_home_member(d.home_id)
  )
);

drop policy if exists "device commands member read" on public.device_commands;
create policy "device commands member read"
on public.device_commands
for select
to authenticated
using (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and public.is_home_member(d.home_id)
  )
);

drop policy if exists "device commands member write" on public.device_commands;
create policy "device commands member write"
on public.device_commands
for insert
to authenticated
with check (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and public.is_home_member(d.home_id)
  )
);

drop policy if exists "telemetry member read" on public.telemetry_events;
create policy "telemetry member read"
on public.telemetry_events
for select
to authenticated
using (
  exists (
    select 1
    from public.devices d
    where d.id = device_id
      and public.is_home_member(d.home_id)
  )
);

drop policy if exists "provisioning admin read" on public.provisioning_sessions;
create policy "provisioning admin read"
on public.provisioning_sessions
for select
to authenticated
using (public.is_home_admin(home_id));

drop policy if exists "provisioning admin write" on public.provisioning_sessions;
create policy "provisioning admin write"
on public.provisioning_sessions
for insert
to authenticated
with check (public.is_home_admin(home_id));

drop policy if exists "audit logs admin read" on public.audit_logs;
create policy "audit logs admin read"
on public.audit_logs
for select
to authenticated
using (
  home_id is not null
  and public.is_home_admin(home_id)
);
