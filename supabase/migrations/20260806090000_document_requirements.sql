-- Módulo: generación de documentos con IA (checklist de requisitos)

create type public.requirement_status as enum ('suggested', 'approved', 'rejected');
create type public.requirement_source as enum ('ai', 'admin');
create type public.case_requirement_fulfillment as enum ('pending', 'fulfilled');

-- Ejemplos de documentos que el despacho comparte por tipo de acto, además
-- de la plantilla con placeholders. Se usan como referencia de estilo al
-- generar con IA.
create table public.template_examples (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  storage_path text not null,
  label text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index template_examples_template_id_idx on public.template_examples (template_id);

-- Checklist de información/documentos que se necesitan para armar un acto
-- de este tipo. La IA propone (source='ai', status='suggested'); un
-- administrador aprueba, agrega los suyos o rechaza los que no aplican.
-- Sólo los 'approved' cuentan para el seguimiento por expediente.
create table public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  act_type_id uuid not null references public.act_types (id),
  label text not null,
  description text,
  is_required boolean not null default true,
  status public.requirement_status not null default 'suggested',
  source public.requirement_source not null default 'ai',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_requirements_act_type_id_idx on public.document_requirements (act_type_id);

create trigger set_updated_at
  before update on public.document_requirements
  for each row execute function public.set_updated_at();

-- Seguimiento por expediente de cada requisito aprobado de su tipo de
-- acto: pendiente hasta que se suba/marque el documento correspondiente.
create table public.case_requirement_status (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  requirement_id uuid not null references public.document_requirements (id) on delete cascade,
  status public.case_requirement_fulfillment not null default 'pending',
  fulfilled_document_id uuid references public.documents (id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id, requirement_id)
);

create index case_requirement_status_case_id_idx on public.case_requirement_status (case_id);

-- Un documento puede subirse para satisfacer un requisito específico del
-- checklist (ej. "copia de identificación oficial").
alter table public.documents add column requirement_id uuid references public.document_requirements (id) on delete set null;

-- Los borradores generados por IA ahora se producen en dos formatos:
-- Word (.docx, en storage_path) para poder editarlos, y PDF (en
-- storage_path_pdf) para compartirlos una vez aprobados.
alter table public.documents add column storage_path_pdf text;

-- Al abrir un expediente nuevo, se le copian (en 'pending') todos los
-- requisitos ya aprobados para su tipo de acto.
create or replace function public.seed_case_requirements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.case_requirement_status (case_id, requirement_id)
  select new.id, dr.id
  from public.document_requirements dr
  where dr.act_type_id = new.act_type_id and dr.status = 'approved';
  return new;
end;
$$;

create trigger seed_case_requirements
  after insert on public.cases
  for each row execute function public.seed_case_requirements();

-- Subir un documento etiquetado con un requisito lo marca cumplido de una
-- vez (no depende de que el borrador de IA ya esté aprobado: el requisito
-- es sobre tener la fuente/información disponible, no sobre el resultado).
create or replace function public.fulfill_case_requirement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.requirement_id is not null then
    update public.case_requirement_status
    set status = 'fulfilled', fulfilled_document_id = new.id, fulfilled_at = now()
    where case_id = new.case_id and requirement_id = new.requirement_id;
  end if;
  return new;
end;
$$;

create trigger fulfill_case_requirement
  after insert on public.documents
  for each row execute function public.fulfill_case_requirement();

-- RLS: template_examples (sigue el mismo criterio que templates)
alter table public.template_examples enable row level security;

create policy "template_examples_select_same_org"
  on public.template_examples for select
  to authenticated
  using (exists (
    select 1 from public.templates t
    where t.id = template_id and t.organization_id = public.current_org()
  ));

create policy "template_examples_write_admin"
  on public.template_examples for all
  to authenticated
  using (
    public.is_admin()
    and exists (select 1 from public.templates t where t.id = template_id and t.organization_id = public.current_org())
  )
  with check (
    public.is_admin()
    and exists (select 1 from public.templates t where t.id = template_id and t.organization_id = public.current_org())
  );

-- RLS: document_requirements — curar el checklist es una decisión de
-- administrador general (aplica a todos los expedientes de ese tipo de
-- acto en la organización, no a un solo departamento).
alter table public.document_requirements enable row level security;

create policy "document_requirements_select_same_org"
  on public.document_requirements for select
  to authenticated
  using (organization_id = public.current_org());

create policy "document_requirements_write_admin"
  on public.document_requirements for all
  to authenticated
  using (organization_id = public.current_org() and public.is_admin())
  with check (organization_id = public.current_org() and public.is_admin());

-- RLS: case_requirement_status
alter table public.case_requirement_status enable row level security;

create policy "case_requirement_status_select_visible"
  on public.case_requirement_status for select
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

-- Marcar manualmente un requisito como cumplido (sin documento adjunto,
-- ej. un dato que se confirmó por teléfono) requiere poder ver el
-- expediente y tener al menos permiso de creación de documentos.
create policy "case_requirement_status_update_visible"
  on public.case_requirement_status for update
  to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.organization_id = public.current_org()
        and public.can_view_case(c.department_id, c.responsible_user_id)
    )
    and (public.is_admin() or public.current_document_permission() >= 'create')
  );
