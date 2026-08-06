# Prompt inicial — Esqueleto Plataforma Legal MX (piloto: Notaría)

Pega esto tal cual como primer mensaje a Claude Code en un repo vacío.

---

## Contexto

Vamos a construir el **esqueleto base** de una plataforma de gestión con IA para
el sector legal mexicano (notarías, corredurías, sujetos obligados en materia de
PLD, despachos jurídicos), inspirada en la funcionalidad de productos existentes
del mercado (no en su marca, diseño ni contenido — esos los construimos propios).

Este repo es parte de **Bloomi**, un software studio. El modelo de trabajo es:

- Este es un **repositorio base (boilerplate)** que se clona una vez por cada
  despacho cliente. Cada clon tiene su propio proyecto de Supabase, aislado de
  los demás. No implementes aislamiento cross-organización entre despachos
  distintos — no hace falta.
- El repo tiene dos zonas claramente separadas, cada una con un dueño distinto:
  - `src/` — frontend (Vite + React + TypeScript). Esta carpeta la edita
    principalmente **Eduardo desde Lovable** (además de Claude Code). Lovable
    sincroniza y edita esta carpeta directamente vía GitHub.
  - `supabase/` — esquema de base de datos, políticas de acceso (RLS) y
    funciones de servidor (Edge Functions). Esta carpeta la mantengo yo, aquí
    en Claude Code. Lovable no la toca ni la despliega.
- Por eso: en esta sesión, **prioriza construir bien `supabase/`** (esquema,
  RLS, Edge Functions) y deja el frontend en un scaffold mínimo y funcional
  — sin invertir tiempo en pulir visualmente la interfaz, porque eso se
  termina de trabajar después en Lovable.

El piloto de esta primera versión es una **notaría**, el giro más completo (usa
los 7 módulos eventualmente). El código debe quedar organizado por módulos para
que, en clones futuros para despachos jurídicos o corredurías, sea trivial
desactivar los módulos que no aplican (ej. un despacho jurídico nunca necesita
PLD).

## Alcance de esta fase (construir ahora)

1. **Autenticación y roles** vía Supabase Auth: notario/socio, abogado/fedatario,
   asistente, administrador. Permisos por rol sobre expedientes y documentos,
   aplicados con políticas RLS (no con lógica de permisos en el frontend).
2. **Sistema de Gestión** (módulo núcleo): CRUD de expedientes/casos, cada uno
   con un tipo de acto (compraventa, poder, testamento, constitutiva, etc.),
   estado, cliente(s) asociados, comparecientes, documentos, responsable y
   fechas límite. Vista de lista de expedientes filtrable por estado/tipo.
3. **Clientes**: base de datos de clientes (persona física/moral) con historial
   de expedientes y documentos asociados.
4. **Generación de documentos con IA**: a partir de una plantilla por tipo de
   acto + los datos capturados del expediente, generar un borrador de documento
   llamando a la API de Claude **desde una Edge Function**, nunca desde el
   frontend. El documento generado SIEMPRE queda en estado "pendiente de
   revisión humana" — nunca se marca como final automáticamente. La aprobación
   también pasa por una Edge Function que valida el rol de quien aprueba.
5. **Transcripciones/OCR con IA**: subir un PDF (escaneado, identificación,
   contrato) a Supabase Storage y usar una Edge Function que llame a la API de
   Claude para extraer el texto estructurado, separado por página.
6. **Alertas de vencimientos**: quedan como registros que se generan cuando un
   expediente se acerca a su fecha límite (vía función programada o revisión
   al abrir el dashboard — tú decides el mecanismo más simple de implementar
   bien).
7. **Bitácora de auditoría**: registro de quién hizo qué acción sensible y
   cuándo. Para operaciones CRUD básicas, usa triggers de Postgres (no se
   puede omitir por accidente desde el frontend). Para acciones de IA
   (generación, aprobación), registra explícitamente desde la Edge Function
   correspondiente, con más contexto del que un trigger genérico podría
   capturar.

## Explícitamente FUERA de esta fase (no lo construyas todavía)

- Calculadora de ISR (reglas fiscales que cambian cada año).
- Add-in de Word (componente Office.js aparte, se construye en un repo
  separado que consume las mismas Edge Functions — no lo mezcles aquí).
- Contabilidad y timbrado de CFDI (requiere contrato con un PAC autorizado
  por el SAT — no se puede simular con datos falsos).
- PLD/KYC real (requiere contrato con un proveedor de listas de
  sanciones/PEP). Si es rápido, deja una Edge Function `check-sanctions-list`
  que reciba los datos de una persona y devuelva un resultado simulado, solo
  para que después sea fácil conectar un proveedor real sin refactorizar. Si
  te quita tiempo del resto, ni te preocupes por esto ahora.

## Stack a usar

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui (el stack
  nativo de Lovable — no te desvíes de esto aunque conozcas otras opciones).
- **Backend**: Supabase — Postgres, Auth, Storage y Edge Functions. No uses
  Prisma ni otro ORM: usa migraciones SQL nativas del Supabase CLI
  (`supabase/migrations/`), que es lo que Lovable también sabe leer.
- **IA**: API de Claude (Anthropic), llamada únicamente desde Edge Functions
  (Deno/TypeScript), con la llave guardada en Supabase Secrets — nunca en el
  bundle del frontend ni en variables `VITE_*`.
- **Storage de archivos**: Supabase Storage, con políticas de acceso a nivel
  de bucket equivalentes a las de las tablas.
- **Despliegue**: Vercel para el build estático del frontend (con preview
  automático por pull request); Supabase para base de datos, auth, storage y
  Edge Functions.

## Estructura del repositorio

```
/
├── src/                    ← frontend (terreno de Lovable + Claude Code)
├── index.html, vite.config.ts, package.json, tailwind.config.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/         ← schema + políticas RLS, en SQL versionado
│   └── functions/
│       ├── generate-document/
│       ├── approve-document/
│       ├── transcribe-ocr/
│       └── check-deadlines/
├── .env.example            ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (placeholders)
└── README.md                ← documenta qué carpeta edita quién
```

## Convenciones

- La interfaz (UI) debe estar en **español mexicano**, orientado a personal de
  una notaría (usa terminología del gremio: expediente, compareciente, acto,
  fedatario, etc.).
- El código (nombres de tablas, columnas, funciones) en **inglés**, como es
  práctica estándar.
- Todo dato sensible (CURP, RFC, domicilios) debe tratarse con cuidado: no lo
  imprimas en logs, no lo mandes a servicios externos salvo los explícitamente
  definidos (Claude API para generación/OCR, dentro de las Edge Functions).
- Cualquier acción de IA debe quedar registrada en `audit_log`, incluyendo qué
  usuario aprobó qué.
- Las políticas RLS son la fuente de verdad de los permisos — el frontend
  puede ocultar botones por rol para mejorar la experiencia, pero nunca debe
  ser el único mecanismo de control de acceso.
- No conectes el frontend directamente a la API de Claude ni guardes
  `ANTHROPIC_API_KEY` en ningún archivo bajo `src/`. Si en algún punto sientes
  que "sería más fácil" hacerlo así, deténte — es exactamente lo que este
  diseño busca evitar.

## Modelo de datos inicial (referencia para las migraciones SQL)

- `profiles` — 1:1 con `auth.users` (id, full_name, role, organization_id).
- `organizations` — id, name (una fila por instancia, pero se mantiene la
  tabla por si a futuro hay varias sucursales de la misma notaría).
- `clients` — persona física o moral: nombre/razón social, RFC, CURP (si
  aplica), domicilio, contacto, tipo.
- `cases` (expedientes) — tipo de acto, estado, organization_id,
  responsible_user_id, opened_at, due_date.
- `case_clients` — tabla intermedia entre `cases` y `clients` (un expediente
  puede tener varios clientes con distintos roles: vendedor, comprador, etc.).
- `case_parties` (comparecientes) — persona relacionada a un expediente que
  no necesariamente es "cliente" (testigos, apoderados).
- `documents` — archivo asociado a un expediente: tipo, versión, estado de
  revisión (borrador IA / en revisión / aprobado), storage_path.
- `templates` — plantilla de documento por tipo de acto, con placeholders.
- `ai_generations` — prompt/input usado, output, estado de aprobación, quién
  aprobó.
- `transcriptions` — archivo origen, texto extraído, estado.
- `alerts` — expediente relacionado, tipo, fecha límite, estado.
- `audit_log` — actor_id, acción, entity_type, entity_id, metadata (jsonb),
  timestamp. Poblada por triggers (CRUD básico) y por Edge Functions
  (acciones de IA).

## Roles y políticas RLS (referencia)

- Todos los roles autenticados pueden leer la mayoría de las tablas.
- `asistente` puede crear/editar expedientes y clientes, pero no puede
  aprobar documentos generados por IA.
- `notario`, `abogado` y `administrador` pueden aprobar documentos generados
  por IA (vía la Edge Function `approve-document`, que valida el rol antes de
  marcar como aprobado).
- `audit_log` es de solo inserción para los usuarios normales — nadie debería
  poder editar o borrar una entrada ya escrita.

## Orden de construcción sugerido

1. Inicializa el proyecto: Vite + React + TypeScript + Tailwind en la raíz, y
   `supabase init` para la carpeta `supabase/`. Configura `.env.example`.
2. Escribe las migraciones SQL del modelo de datos completo (tablas +
   relaciones + trigger genérico de auditoría).
3. Define las políticas RLS por tabla y por rol. Pruébalas con usuarios de
   prueba de cada rol antes de seguir — todo lo demás depende de que esto
   funcione correctamente.
4. Construye el cliente de Supabase en el frontend (`src/lib/supabase.ts`) +
   páginas de login conectadas a Supabase Auth + creación del primer
   `profile` (rol administrador) al registrar al primer usuario.
5. Construye el layout base con navegación protegida por rol (aunque sea
   simple — el refinamiento visual lo hace Eduardo después en Lovable).
6. Construye el CRUD de Clientes y Expedientes, incluyendo `case_clients` y
   `case_parties`.
7. Construye la Edge Function `generate-document` y `approve-document`, más
   una vista simple de "documentos pendientes de revisión" en el frontend.
8. Construye la Edge Function `transcribe-ocr` y una pantalla simple de carga
   de PDF + visualización del texto extraído.
9. Construye Alertas de vencimientos.
10. Verifica que `audit_log` esté capturando correctamente las acciones de
    los pasos 6 a 9.

## Primer entregable que te pido

Antes de generar nada más, **propón primero**:
- La estructura de carpetas del proyecto.
- Las migraciones SQL completas del modelo de datos de arriba, incluyendo el
  trigger de auditoría.
- El diseño de las políticas RLS por tabla y rol.

Muéstramelos para que los revise antes de que generes el resto del código.
