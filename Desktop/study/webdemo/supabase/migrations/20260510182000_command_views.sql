create or replace view public.device_command_summary
with (security_invoker = true)
as
select
  dc.id,
  dc.device_id,
  dc.correlation_id,
  dc.command_type,
  dc.status,
  dc.requested_at,
  dc.delivered_at,
  dc.acknowledged_at,
  dc.failure_reason,
  ds.desired_state,
  ds.reported_state
from public.device_commands dc
left join public.device_state ds
  on ds.device_id = dc.device_id;
