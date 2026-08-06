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
