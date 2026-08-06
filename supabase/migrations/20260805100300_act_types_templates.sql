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
