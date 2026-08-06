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
