select 'homes_table' as check_name, to_regclass('public.homes') is not null as passed
union all
select 'rooms_table', to_regclass('public.rooms') is not null
union all
select 'devices_table', to_regclass('public.devices') is not null
union all
select 'device_state_table', to_regclass('public.device_state') is not null
union all
select 'device_commands_table', to_regclass('public.device_commands') is not null
union all
select 'telemetry_events_table', to_regclass('public.telemetry_events') is not null
union all
select 'provisioning_sessions_table', to_regclass('public.provisioning_sessions') is not null
union all
select 'audit_logs_table', to_regclass('public.audit_logs') is not null
union all
select 'desired_state_column', exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'device_state'
    and column_name = 'desired_state'
)
union all
select 'reported_state_column', exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'device_state'
    and column_name = 'reported_state'
)
union all
select 'command_status_column', exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'device_commands'
    and column_name = 'status'
)
union all
select 'rls_devices_enabled', exists (
  select 1
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'devices'
    and c.relrowsecurity
)
union all
select 'rls_device_commands_enabled', exists (
  select 1
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'device_commands'
    and c.relrowsecurity
);
