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
