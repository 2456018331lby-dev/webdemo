create extension if not exists "pgcrypto";

create type public.home_member_role as enum ('owner', 'member', 'installer', 'admin');
create type public.device_command_status as enum ('queued', 'delivered', 'acknowledged', 'failed', 'timed_out');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.home_members (
  home_id uuid not null references public.homes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.home_member_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (home_id, profile_id)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  name text not null,
  device_type text not null,
  bridge_id text unique,
  controller_id text,
  firmware_version text,
  online boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.device_modules (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  module_type text not null,
  module_key text not null,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.device_state (
  device_id uuid primary key references public.devices (id) on delete cascade,
  desired_state jsonb not null default '{}'::jsonb,
  reported_state jsonb not null default '{}'::jsonb,
  last_reported_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  correlation_id text not null unique,
  command_type text not null,
  status public.device_command_status not null default 'queued',
  payload jsonb not null,
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  failure_reason text
);

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  reported_at timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  reported_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.provisioning_sessions (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  bridge_id text,
  status text not null default 'pending',
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.firmware_versions (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  version text not null,
  artifact_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  home_id uuid references public.homes (id) on delete set null,
  device_id uuid references public.devices (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_home_members_profile_id on public.home_members (profile_id);
create index if not exists idx_rooms_home_id on public.rooms (home_id);
create index if not exists idx_devices_home_id on public.devices (home_id);
create index if not exists idx_devices_room_id on public.devices (room_id);
create index if not exists idx_device_commands_device_id_requested_at on public.device_commands (device_id, requested_at desc);
create index if not exists idx_device_commands_status on public.device_commands (status);
create index if not exists idx_telemetry_events_device_id_reported_at on public.telemetry_events (device_id, reported_at desc);
