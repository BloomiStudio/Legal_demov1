-- Módulo: alertas de vencimiento

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  alert_type text not null default 'due_date_approaching',
  due_date date not null,
  status public.alert_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index alerts_case_id_idx on public.alerts (case_id);
create index alerts_status_idx on public.alerts (status);

alter table public.alerts enable row level security;

create policy "alerts_select_visible"
  on public.alerts for select
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

create policy "alerts_update_status_visible"
  on public.alerts for update
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

-- Las alertas se generan desde la Edge Function check-deadlines
-- (service_role); no hay política de insert/delete para authenticated. Los
-- usuarios sólo pueden actualizar el status (ej. marcar como "dismissed").
