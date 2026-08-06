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
