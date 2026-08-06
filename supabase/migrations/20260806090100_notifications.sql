-- Módulo: generación de documentos con IA (notificaciones de faltantes)

-- Si el despacho lo decide (por expediente), además de avisar
-- internamente, se le puede avisar al cliente final para que provea lo que
-- falta. El envío real de ese correo se resuelve en la Edge Function
-- check-case-requirements (hoy sólo deja constancia en audit_log; conectar
-- un proveedor de correo real no requiere tocar el esquema).
alter table public.cases add column notify_client_on_missing_docs boolean not null default false;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_id_idx on public.notifications (recipient_user_id, is_read);

alter table public.notifications enable row level security;

create policy "notifications_select_own_or_admin"
  on public.notifications for select
  to authenticated
  using (recipient_user_id = auth.uid() or public.is_admin());

-- Marcar como leída es lo único que un usuario normal puede hacer sobre su
-- propia notificación.
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (recipient_user_id = auth.uid());

-- Sin política de insert/delete para authenticated: las crea únicamente la
-- Edge Function check-case-requirements con la service_role key.
