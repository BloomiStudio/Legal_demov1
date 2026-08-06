// Stub para PLD/KYC: hoy simula una respuesta para que el frontend y el
// modelo de datos ya tengan la forma correcta, y conectar un proveedor real
// de listas de sanciones/PEP más adelante no requiera refactorizar nada más
// que el cuerpo de esta función.
import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { full_name, rfc, curp } = await req.json();
    if (!full_name) return json({ error: "full_name es requerido" }, 400);

    // Respuesta simulada — determinística por nombre para que el demo sea
    // consistente, NO es una verificación real contra ninguna lista.
    const result = {
      full_name,
      rfc: rfc ?? null,
      curp: curp ?? null,
      match_found: false,
      lists_checked: ["OFAC (simulado)", "ONU (simulado)", "PEP México (simulado)"],
      checked_at: new Date().toISOString(),
      provider: "simulado",
    };

    return json({ result });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
