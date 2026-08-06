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
