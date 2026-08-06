-- Módulo: bitácora de auditoría

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  action text not null, -- 'insert' | 'update' | 'delete' | 'ai_generate' | 'ai_approve' | ...
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_id_idx on public.audit_log (actor_id);

-- Trigger genérico de auditoría para operaciones CRUD básicas. SECURITY
-- DEFINER para que la escritura en audit_log nunca dependa de que el rol
-- que dispara el trigger tenga permiso de insert sobre la tabla auditada.
create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_metadata jsonb;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_metadata := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_metadata := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    v_entity_id := new.id;
    v_metadata := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_metadata);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_trigger_fn();

create trigger audit_cases
  after insert or update or delete on public.cases
  for each row execute function public.audit_trigger_fn();

create trigger audit_case_clients
  after insert or update or delete on public.case_clients
  for each row execute function public.audit_trigger_fn();

create trigger audit_case_parties
  after insert or update or delete on public.case_parties
  for each row execute function public.audit_trigger_fn();

create trigger audit_documents
  after insert or update or delete on public.documents
  for each row execute function public.audit_trigger_fn();

create trigger audit_templates
  after insert or update or delete on public.templates
  for each row execute function public.audit_trigger_fn();

-- Cambios de rol, departamento, bandera de admin de departamento o nivel de
-- permiso sobre documentos son acciones sensibles: quedan auditadas igual
-- que cualquier otro update. No se audita el insert (lo hace el trigger
-- handle_new_user al registrarse un usuario, no una acción de un actor).
create trigger audit_profiles
  after update on public.profiles
  for each row execute function public.audit_trigger_fn();

create trigger audit_departments
  after insert or update or delete on public.departments
  for each row execute function public.audit_trigger_fn();

-- Las acciones de IA (generación, aprobación) NO usan este trigger genérico:
-- las Edge Functions generate-document y approve-document insertan
-- directamente en audit_log con más contexto (prompt usado, quién aprobó,
-- etc.) del que este trigger podría capturar por sí solo.

alter table public.audit_log enable row level security;

-- La bitácora es una herramienta de supervisión de administradores, no una
-- vista general para todo el personal: un administrador general la ve
-- completa; un administrador de departamento sólo ve las acciones cuyo
-- actor pertenece a su propio departamento.
create policy "audit_log_select_admin_scoped"
  on public.audit_log for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_department_admin()
      and exists (
        select 1 from public.profiles p
        where p.id = actor_id and p.department_id = public.current_department()
      )
    )
  );

create policy "audit_log_insert_authenticated"
  on public.audit_log for insert
  to authenticated
  with check (actor_id = auth.uid());

-- Sin políticas de update/delete: una vez escrita, ninguna entrada de
-- audit_log puede modificarse ni borrarse desde el rol authenticated.
