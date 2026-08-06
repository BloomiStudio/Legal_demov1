# Plataforma Legal MX — piloto Notaría

Esqueleto base (boilerplate) de la plataforma de gestión con IA para el
sector legal mexicano, construido por **Bloomi**. Este repositorio se clona
una vez por cada despacho cliente; cada clon usa su propio proyecto de
Supabase, aislado de los demás.

## Quién edita qué

| Carpeta      | Dueño                              | Notas                                                                 |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| `src/`       | Eduardo (Lovable) + Claude Code     | Frontend. Lovable sincroniza y edita esta carpeta directamente vía GitHub. |
| `supabase/`  | Claude Code                         | Esquema, RLS y Edge Functions. Lovable no la toca ni la despliega.       |

Por eso el frontend en este momento es un scaffold mínimo — el refinamiento
visual se hace después en Lovable. `supabase/` es donde vive la lógica de
negocio real: nada de permisos depende del frontend, todo pasa por RLS o por
Edge Functions.

## Módulos

El código está organizado por módulo (auth/núcleo, clientes, gestión de
expedientes, documentos, IA, transcripciones, alertas, auditoría) para que en
clones futuros de despachos jurídicos o corredurías sea trivial desactivar
los módulos que no aplican (ej. un despacho jurídico nunca necesita PLD).

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions). Migraciones
  SQL nativas en `supabase/migrations/`, sin ORM.
- **IA**: API de Claude (Anthropic), llamada únicamente desde Edge Functions
  (Deno/TypeScript). La llave vive en Supabase Secrets, nunca en el bundle
  del frontend.
- **Despliegue**: Vercel (frontend) + Supabase (backend).

## Desarrollo local

1. Instala el [Supabase CLI](https://supabase.com/docs/guides/cli).
2. `supabase start` para levantar Postgres/Auth/Storage localmente.
3. `supabase db reset` para aplicar todas las migraciones de
   `supabase/migrations/` desde cero.
4. Copia `.env.example` a `.env` y llena `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` con los valores que imprime `supabase start`.
5. `npm install && npm run dev`.

## Seguridad

- Las políticas RLS son la fuente de verdad de los permisos. El frontend
  puede ocultar botones por rol, pero nunca es el único mecanismo de control
  de acceso.
- `ANTHROPIC_API_KEY` vive únicamente en Supabase Secrets y se usa solo
  dentro de Edge Functions.
- Toda acción de IA (generación, aprobación) queda registrada en
  `audit_log`, incluyendo qué usuario aprobó qué.
