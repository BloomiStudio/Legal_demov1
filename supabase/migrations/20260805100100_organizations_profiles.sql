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
