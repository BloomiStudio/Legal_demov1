-- Migraciones combinadas para pegar una sola vez en el SQL Editor de Supabase.
-- Generado a partir de supabase/migrations/*.sql en orden. No editar directamente:
-- si necesitas cambiar el esquema, edita los archivos individuales y regenera esto.

-- ============================================================
-- 20260805100000_extensions_and_types.sql
-- ============================================================
-- Módulo: núcleo
-- Extensiones y tipos compartidos por el resto de las migraciones.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('administrador', 'notario', 'abogado', 'asistente');

create type public.case_status as enum ('open', 'in_progress', 'closed', 'cancelled');

create type public.document_review_status as enum ('ai_draft', 'in_review', 'approved', 'rejected');

create type public.ai_approval_status as enum ('pending', 'approved', 'rejected');

create type public.transcription_status as enum ('pending', 'processing', 'completed', 'failed');

create type public.alert_status as enum ('pending', 'sent', 'dismissed', 'resolved');

-- Nivel de acceso a documentos asignado por un administrador a cada
-- usuario, independiente de su rol profesional. Los valores están en orden
-- creciente de capacidad (Postgres compara enums por su orden de creación),
-- así que "edit" implica todo lo de "create", que implica "comment", etc.
create type public.document_permission as enum ('read', 'comment', 'create', 'edit');

-- Alcance de visibilidad de expedientes que un administrador asigna a cada
-- usuario: sólo los propios, todo su departamento, una lista específica de
-- departamentos, o toda la organización.
create type public.visibility_scope as enum ('own', 'department', 'specific_departments', 'organization');

-- Trigger genérico reutilizado por todas las tablas con columna updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 20260805100100_organizations_profiles.sql
-- ============================================================
-- Módulo: núcleo (auth y roles)

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- Departamentos dentro de la misma organización (ej. "Compraventas",
-- "Corporativo", "Testamentos"). Cada usuario pertenece a lo sumo a uno.
-- Un departamento puede tener uno o más "administradores de departamento"
-- (profiles.is_department_admin), que sólo pueden gestionar permisos de
-- usuarios de ese mismo departamento. La lista de departamentos en sí
-- (crear/renombrar/borrar) la maneja únicamente un administrador general.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index departments_organization_id_idx on public.departments (organization_id);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  full_name text not null,
  role public.app_role not null default 'asistente',
  is_department_admin boolean not null default false,
  document_permission public.document_permission not null default 'read',
  can_comment boolean not null default false,
  case_visibility_scope public.visibility_scope not null default 'department',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Sólo se usa cuando case_visibility_scope = 'specific_departments': la
-- lista de departamentos adicionales que ese usuario puede ver, más allá
-- (o en lugar) del suyo. Administrada únicamente por un administrador
-- general, porque conceder visibilidad entre departamentos es una decisión
-- que afecta a un departamento que no es el del admin que la otorga — un
-- admin de departamento no puede tomar esa decisión por otro departamento.
create table public.profile_visible_departments (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  primary key (profile_id, department_id)
);

-- Funciones auxiliares usadas por las políticas RLS de todas las tablas.
-- SECURITY DEFINER para poder leer `profiles` sin depender de las propias
-- políticas RLS de esa tabla (evita recursión).

create or replace function public.current_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_org()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = 'administrador';
$$;

create or replace function public.can_approve_documents()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() in ('notario', 'abogado', 'administrador');
$$;

create or replace function public.current_department()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_department_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_department_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_document_permission()
returns public.document_permission
language sql
security definer
set search_path = public
stable
as $$
  select document_permission from public.profiles where id = auth.uid();
$$;

-- Un administrador general puede gestionar (cambiar permisos de) cualquier
-- usuario. Un administrador de departamento sólo puede gestionar usuarios
-- de su propio departamento.
create or replace function public.can_manage_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or (
      public.is_department_admin()
      and public.current_department() is not null
      and public.current_department() = (
        select department_id from public.profiles where id = target_user_id
      )
    );
$$;

create or replace function public.current_can_comment()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select can_comment from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_case_visibility_scope()
returns public.visibility_scope
language sql
security definer
set search_path = public
stable
as $$
  select case_visibility_scope from public.profiles where id = auth.uid();
$$;

-- Puerta única de visibilidad de expedientes, usada por todas las tablas
-- que dependen de un caso (documentos, comentarios, alertas, IA...).
-- Un administrador general ve todo; un administrador de departamento ve
-- todo lo de su propio departamento (independientemente de su propio
-- case_visibility_scope); cualquier otro usuario ve según el alcance
-- configurado en su perfil.
create or replace function public.can_view_case(p_department_id uuid, p_responsible_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or (public.is_department_admin() and public.current_department() = p_department_id)
    or (
      case public.current_case_visibility_scope()
        when 'organization' then true
        when 'specific_departments' then exists (
          select 1 from public.profile_visible_departments v
          where v.profile_id = auth.uid() and v.department_id = p_department_id
        )
        when 'department' then
          public.current_department() is not null and public.current_department() = p_department_id
        else coalesce(p_responsible_user_id = auth.uid(), false) -- 'own'
      end
    );
$$;

-- Al registrarse el primer usuario del proyecto, se crea la organización,
-- un departamento inicial ("General", que el admin puede renombrar o
-- complementar con más departamentos después) y ese usuario queda como
-- administrador general con visibilidad total. Cualquier usuario posterior
-- entra como asistente sin organización ni departamento asignado, hasta que
-- un administrador lo reasigne desde la UI.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  new_dept_id uuid;
  is_first_user boolean;
begin
  select not exists (select 1 from public.profiles) into is_first_user;

  if is_first_user then
    insert into public.organizations (name) values ('Mi Notaría') returning id into new_org_id;
    insert into public.departments (organization_id, name) values (new_org_id, 'General') returning id into new_dept_id;
    insert into public.profiles (
      id, full_name, role, organization_id, department_id,
      is_department_admin, document_permission, can_comment, case_visibility_scope
    )
      values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
        'administrador',
        new_org_id,
        new_dept_id,
        true,
        'edit',
        true,
        'organization'
      );
  else
    insert into public.profiles (id, full_name, role)
      values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'asistente');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un usuario normal puede editar su propio perfil (ej. full_name), pero no
-- puede escalar sus propios privilegios. Reglas:
--   - role / department_id / is_department_admin / organization_id: sólo un
--     administrador general puede modificarlos, en cualquier perfil.
--   - document_permission / can_comment: un administrador general puede
--     modificarlos en cualquier perfil; un administrador de departamento
--     puede modificarlos únicamente en perfiles de OTROS usuarios de su
--     propio departamento (no en el suyo, para que no se autoasigne más
--     permiso).
--   - case_visibility_scope: misma regla que document_permission/
--     can_comment, PERO un administrador de departamento sólo puede dejarlo
--     en 'own' o 'department' — subir a alguien a 'specific_departments' u
--     'organization' expone información de otros departamentos y queda
--     reservado al administrador general.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    new.role = old.role;
    new.department_id = old.department_id;
    new.is_department_admin = old.is_department_admin;
    new.organization_id = old.organization_id;
  end if;

  if new.document_permission is distinct from old.document_permission
     and not (public.is_admin() or (public.can_manage_user(old.id) and old.id <> auth.uid())) then
    new.document_permission = old.document_permission;
  end if;

  if new.can_comment is distinct from old.can_comment
     and not (public.is_admin() or (public.can_manage_user(old.id) and old.id <> auth.uid())) then
    new.can_comment = old.can_comment;
  end if;

  if new.case_visibility_scope is distinct from old.case_visibility_scope then
    if not (public.is_admin() or (public.can_manage_user(old.id) and old.id <> auth.uid())) then
      new.case_visibility_scope = old.case_visibility_scope;
    elsif not public.is_admin() and new.case_visibility_scope in ('specific_departments', 'organization') then
      new.case_visibility_scope = old.case_visibility_scope;
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_fields();

-- RLS: organizations
alter table public.organizations enable row level security;

create policy "organizations_select_authenticated"
  on public.organizations for select
  to authenticated
  using (true);

create policy "organizations_insert_admin"
  on public.organizations for insert
  to authenticated
  with check (public.is_admin());

create policy "organizations_update_admin"
  on public.organizations for update
  to authenticated
  using (public.is_admin());

create policy "organizations_delete_admin"
  on public.organizations for delete
  to authenticated
  using (public.is_admin());

-- RLS: departments
alter table public.departments enable row level security;

create policy "departments_select_authenticated"
  on public.departments for select
  to authenticated
  using (true);

create policy "departments_write_admin"
  on public.departments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- RLS: profiles
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- No hay política de insert: los perfiles sólo se crean vía el trigger
-- handle_new_user (SECURITY DEFINER, ignora RLS).

-- El guard de arriba (guard_profile_privileged_fields) decide, campo por
-- campo, qué puede tocar cada quién; esta política sólo decide quién puede
-- intentar un update en primer lugar: uno mismo, un admin general, o un
-- admin del departamento del perfil editado.
create policy "profiles_update_own_or_managed"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.can_manage_user(id));

create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- RLS: profile_visible_departments
alter table public.profile_visible_departments enable row level security;

create policy "profile_visible_departments_select_self_or_admin"
  on public.profile_visible_departments for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy "profile_visible_departments_write_admin"
  on public.profile_visible_departments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 20260805100200_clients.sql
-- ============================================================
-- Módulo: clientes

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_type text not null check (client_type in ('persona_fisica', 'persona_moral')),
  full_name text not null, -- nombre completo o razón social
  rfc text,
  curp text, -- sólo aplica a persona física
  address text,
  phone text,
  email text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_organization_id_idx on public.clients (organization_id);

create trigger set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients_select_same_org"
  on public.clients for select
  to authenticated
  using (organization_id = public.current_org());

create policy "clients_insert_same_org"
  on public.clients for insert
  to authenticated
  with check (organization_id = public.current_org());

create policy "clients_update_same_org"
  on public.clients for update
  to authenticated
  using (organization_id = public.current_org());

create policy "clients_delete_admin"
  on public.clients for delete
  to authenticated
  using (organization_id = public.current_org() and public.is_admin());

-- ============================================================
-- 20260805100300_act_types_templates.sql
-- ============================================================
-- Módulo: gestión (catálogo de actos y plantillas)

create table public.act_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- ej. 'compraventa', 'poder', 'testamento'
  name text not null, -- etiqueta para mostrar en la UI
  module text not null default 'gestion', -- permite desactivar un módulo completo en clones futuros
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.act_types (code, name) values
  ('compraventa', 'Compraventa'),
  ('poder', 'Poder Notarial'),
  ('testamento', 'Testamento'),
  ('constitutiva', 'Acta Constitutiva'),
  ('donacion', 'Donación'),
  ('fideicomiso', 'Fideicomiso'),
  ('credito_hipotecario', 'Crédito Hipotecario');

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  act_type_id uuid not null references public.act_types (id),
  name text not null,
  content text not null, -- cuerpo de la plantilla con placeholders {{...}}
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_organization_id_idx on public.templates (organization_id);
create index templates_act_type_id_idx on public.templates (act_type_id);

create trigger set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.act_types enable row level security;

create policy "act_types_select_authenticated"
  on public.act_types for select
  to authenticated
  using (true);

create policy "act_types_write_admin"
  on public.act_types for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.templates enable row level security;

create policy "templates_select_same_org"
  on public.templates for select
  to authenticated
  using (organization_id = public.current_org());

create policy "templates_write_admin"
  on public.templates for all
  to authenticated
  using (organization_id = public.current_org() and public.is_admin())
  with check (organization_id = public.current_org() and public.is_admin());

-- ============================================================
-- 20260805100400_cases.sql
-- ============================================================
-- Módulo: gestión (expedientes)

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  department_id uuid not null references public.departments (id),
  act_type_id uuid not null references public.act_types (id),
  status public.case_status not null default 'open',
  title text not null, -- descripción corta del expediente
  responsible_user_id uuid references public.profiles (id),
  opened_at date not null default current_date,
  due_date date,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cases_organization_id_idx on public.cases (organization_id);
create index cases_department_id_idx on public.cases (department_id);
create index cases_status_idx on public.cases (status);
create index cases_act_type_id_idx on public.cases (act_type_id);
create index cases_responsible_user_id_idx on public.cases (responsible_user_id);

create trigger set_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- Un administrador general siempre puede asignar/reasignar un expediente.
-- Un administrador de departamento sólo puede hacerlo dentro de su propio
-- departamento.
create or replace function public.can_assign_case(target_department_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or (public.is_department_admin() and public.current_department() = target_department_id);
$$;

-- Mover un expediente de departamento o reasignar a otra persona son
-- decisiones de administrador, no de cualquier usuario con acceso al
-- expediente. Al crear un expediente se rechaza de forma explícita (mensaje
-- claro al usuario); al actualizar uno existente se revierten en silencio
-- esos dos campos para no bloquear el resto de cambios legítimos (notas,
-- status, fecha límite) que puedan venir en el mismo guardado.
create or replace function public.guard_case_assignment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      if public.current_department() is null then
        raise exception 'no perteneces a un departamento; pide a un administrador que te asigne uno antes de crear expedientes';
      end if;
      if new.department_id is distinct from public.current_department() then
        raise exception 'sólo puedes crear expedientes dentro de tu propio departamento';
      end if;
    end if;

    if new.responsible_user_id is null then
      new.responsible_user_id = auth.uid();
    elsif new.responsible_user_id <> auth.uid() and not public.can_assign_case(new.department_id) then
      raise exception 'sólo un administrador puede asignar el expediente a otra persona';
    end if;

    return new;
  end if;

  if new.department_id is distinct from old.department_id and not public.is_admin() then
    new.department_id = old.department_id;
  end if;

  if new.responsible_user_id is distinct from old.responsible_user_id
     and not public.can_assign_case(old.department_id) then
    new.responsible_user_id = old.responsible_user_id;
  end if;

  return new;
end;
$$;

create trigger guard_case_assignment
  before insert or update on public.cases
  for each row execute function public.guard_case_assignment();

-- Compareciente que además es cliente (comprador, vendedor, otorgante...).
create table public.case_clients (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  role_in_case text not null, -- ej. 'vendedor', 'comprador', 'otorgante'
  unique (case_id, client_id, role_in_case)
);

create index case_clients_case_id_idx on public.case_clients (case_id);
create index case_clients_client_id_idx on public.case_clients (client_id);

-- Compareciente que no está dado de alta como cliente (testigo, apoderado...).
create table public.case_parties (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  full_name text not null,
  party_role text not null, -- ej. 'testigo', 'apoderado', 'representante_legal'
  rfc text,
  curp text,
  identification_notes text,
  created_at timestamptz not null default now()
);

create index case_parties_case_id_idx on public.case_parties (case_id);

alter table public.cases enable row level security;

create policy "cases_select_visible"
  on public.cases for select
  to authenticated
  using (
    organization_id = public.current_org()
    and public.can_view_case(department_id, responsible_user_id)
  );

-- El chequeo de "sólo tu propio departamento" para la creación vive en el
-- trigger guard_case_assignment (da un mensaje de error más claro que una
-- política RLS genérica); aquí sólo se exige pertenecer a la organización.
create policy "cases_insert_same_org"
  on public.cases for insert
  to authenticated
  with check (organization_id = public.current_org());

create policy "cases_update_visible"
  on public.cases for update
  to authenticated
  using (
    organization_id = public.current_org()
    and public.can_view_case(department_id, responsible_user_id)
  );

create policy "cases_delete_admin"
  on public.cases for delete
  to authenticated
  using (organization_id = public.current_org() and public.is_admin());

alter table public.case_clients enable row level security;

create policy "case_clients_select_visible"
  on public.case_clients for select
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

create policy "case_clients_write_visible"
  on public.case_clients for all
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

alter table public.case_parties enable row level security;

create policy "case_parties_select_visible"
  on public.case_parties for select
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

create policy "case_parties_write_visible"
  on public.case_parties for all
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ))
  with check (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

-- ============================================================
-- 20260805100500_documents.sql
-- ============================================================
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

-- ============================================================
-- 20260805100600_ai_generations.sql
-- ============================================================
-- Módulo: generación de documentos con IA

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  template_id uuid references public.templates (id),
  input_data jsonb not null, -- datos del expediente usados como input del prompt
  prompt_used text,
  output text,
  approval_status public.ai_approval_status not null default 'pending',
  requested_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index ai_generations_case_id_idx on public.ai_generations (case_id);

alter table public.ai_generations enable row level security;

create policy "ai_generations_select_visible"
  on public.ai_generations for select
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

-- Sin políticas de insert/update/delete para authenticated: esta tabla sólo
-- se escribe desde las Edge Functions generate-document y approve-document,
-- usando la service_role key (que ignora RLS).

-- ============================================================
-- 20260805100700_transcriptions.sql
-- ============================================================
-- Módulo: transcripciones/OCR con IA

create table public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  source_storage_path text not null,
  status public.transcription_status not null default 'pending',
  extracted_text jsonb, -- [{ "page": 1, "text": "..." }, ...]
  error_message text,
  requested_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transcriptions_case_id_idx on public.transcriptions (case_id);

create trigger set_updated_at
  before update on public.transcriptions
  for each row execute function public.set_updated_at();

alter table public.transcriptions enable row level security;

create policy "transcriptions_select_visible"
  on public.transcriptions for select
  to authenticated
  using (
    case_id is null
    or exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.organization_id = public.current_org()
        and public.can_view_case(c.department_id, c.responsible_user_id)
    )
  );

-- Igual que ai_generations: sólo la Edge Function transcribe-ocr escribe
-- aquí, con la service_role key. El cliente sube el PDF a Storage y luego
-- invoca la función, que crea y actualiza la fila.

-- ============================================================
-- 20260805100800_alerts.sql
-- ============================================================
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

-- ============================================================
-- 20260805100900_audit_log.sql
-- ============================================================
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

-- ============================================================
-- 20260805101000_storage_buckets.sql
-- ============================================================
-- Módulo: storage

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- Convención de rutas sugerida: {case_id}/{filename}. Como cada despacho
-- cliente tiene su propio proyecto de Supabase (ver README), no hace falta
-- aislar por organización a nivel de política de storage; basta con exigir
-- que el usuario esté autenticado, igual que en las tablas.

create policy "documents_bucket_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

create policy "documents_bucket_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');

create policy "documents_bucket_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documents');

create policy "documents_bucket_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and public.is_admin());

create policy "uploads_bucket_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'uploads');

create policy "uploads_bucket_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'uploads');

create policy "uploads_bucket_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'uploads' and public.is_admin());

-- ============================================================
-- 20260805101100_case_comments.sql
-- ============================================================
-- Módulo: gestión (comentarios de expediente)

create table public.case_comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create index case_comments_case_id_idx on public.case_comments (case_id);

alter table public.case_comments enable row level security;

create policy "case_comments_select_visible"
  on public.case_comments for select
  to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_id
      and c.organization_id = public.current_org()
      and public.can_view_case(c.department_id, c.responsible_user_id)
  ));

-- Comentar requiere poder ver el expediente Y tener permiso de comentar:
-- los administradores (generales o de departamento) siempre pueden;
-- cualquier otro usuario necesita current_can_comment() = true, que un
-- admin le otorga explícitamente (ver profiles.can_comment).
create policy "case_comments_insert_with_permission"
  on public.case_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.organization_id = public.current_org()
        and public.can_view_case(c.department_id, c.responsible_user_id)
    )
    and (public.is_admin() or public.is_department_admin() or public.current_can_comment())
  );

-- Sin políticas de update/delete: un comentario, una vez publicado, queda
-- como parte inmutable del historial del expediente (igual que audit_log).

create trigger audit_case_comments
  after insert on public.case_comments
  for each row execute function public.audit_trigger_fn();

-- ============================================================
-- 20260806090000_document_requirements.sql
-- ============================================================
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

-- ============================================================
-- 20260806090100_notifications.sql
-- ============================================================
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

