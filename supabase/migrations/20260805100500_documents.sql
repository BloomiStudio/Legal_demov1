-- Módulo: gestión (documentos)

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  document_type text not null, -- ej. 'escritura', 'identificacion', 'contrato'
  version integer not null default 1,
  review_status public.document_review_status not null default 'ai_draft',
  storage_path text not null,
  generated_by_ai boolean not null default false,
  uploaded_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_case_id_idx on public.documents (case_id);
create index documents_review_status_idx on public.documents (review_status);

create trigger set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- El review_status de un documento generado por IA sólo puede cambiar a
-- través de la Edge Function approve-document (que corre con la
-- service_role key, después de validar el rol de quien aprueba). Ningún
-- cliente autenticado puede saltarse este flujo aunque RLS le permita
-- actualizar la fila. Los documentos subidos manualmente (generated_by_ai =
-- false, ej. una identificación escaneada) no pasan por este flujo.
create or replace function public.guard_document_review_status()
returns trigger
language plpgsql
as $$
begin
  if not coalesce(new.generated_by_ai, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.review_status <> 'ai_draft' and auth.role() <> 'service_role' then
      raise exception 'un documento generado por IA sólo puede crearse en estado ai_draft';
    end if;
    return new;
  end if;

  if new.review_status is distinct from old.review_status and auth.role() <> 'service_role' then
    raise exception 'review_status de un documento generado por IA sólo puede cambiar mediante approve-document';
  end if;

  return new;
end;
$$;

create trigger guard_document_review_status
  before insert or update on public.documents
  for each row execute function public.guard_document_review_status();

alter table public.documents enable row level security;

create policy "documents_select_visible"
  on public.documents for select
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

-- Además de poder ver el expediente al que pertenece, quien sube/crea un
-- documento necesita al menos el nivel "create" en su document_permission
-- (asignado por un administrador general o de su departamento). Un
-- administrador general siempre puede, independientemente de su nivel.
create policy "documents_insert_visible"
  on public.documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.organization_id = public.current_org()
        and public.can_view_case(c.department_id, c.responsible_user_id)
    )
    and (public.is_admin() or public.current_document_permission() >= 'create')
  );

-- Editar un documento existente requiere el nivel "edit".
create policy "documents_update_visible"
  on public.documents for update
  to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.organization_id = public.current_org()
        and public.can_view_case(c.department_id, c.responsible_user_id)
    )
    and (public.is_admin() or public.current_document_permission() >= 'edit')
  );

create policy "documents_delete_admin"
  on public.documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id and c.organization_id = public.current_org()
    )
    and public.is_admin()
  );
