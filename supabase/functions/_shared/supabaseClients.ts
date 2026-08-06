import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cliente "a nombre del usuario": respeta RLS, se usa para verificar que
// quien llama a la función realmente tiene acceso a lo que está pidiendo
// (ver el expediente, tener rol de aprobador, etc.) antes de hacer nada
// con privilegios elevados.
export function createUserClient(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

// Cliente con la service_role key: ignora RLS. Sólo se usa DESPUÉS de haber
// validado permisos con el cliente de arriba, y únicamente dentro de Edge
// Functions (nunca se expone esta llave al frontend).
export function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
