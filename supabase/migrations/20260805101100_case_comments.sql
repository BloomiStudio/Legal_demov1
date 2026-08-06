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
