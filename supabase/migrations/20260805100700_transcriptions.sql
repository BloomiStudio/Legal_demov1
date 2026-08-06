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
