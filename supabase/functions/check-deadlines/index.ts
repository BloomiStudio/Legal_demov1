// Revisa expedientes abiertos cuya fecha límite se acerca y genera una
// alerta si todavía no existe una pendiente para ese expediente. Pensada
// para dispararse por un Cron Job de Supabase (Edge Functions > Cron),
// una vez al día; por eso no valida un JWT de usuario (config.toml:
// verify_jwt = false) — protégela igual con el secreto que Supabase agrega
// automáticamente a las invocaciones de cron.
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseClients.ts";

const WARNING_WINDOW_DAYS = 5;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const admin = createAdminClient();
    const today = new Date();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + WARNING_WINDOW_DAYS);

    const { data: cases, error } = await admin
      .from("cases")
      .select("id, title, due_date")
      .not("due_date", "is", null)
      .lte("due_date", limit.toISOString().slice(0, 10))
      .gte("due_date", today.toISOString().slice(0, 10))
      .in("status", ["open", "in_progress"]);
    if (error) return json({ error: error.message }, 500);

    let created = 0;
    for (const c of cases ?? []) {
      const { data: existing } = await admin
        .from("alerts")
        .select("id")
        .eq("case_id", c.id)
        .eq("due_date", c.due_date)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) continue;

      const { error: insertError } = await admin.from("alerts").insert({
        case_id: c.id,
        alert_type: "due_date_approaching",
        due_date: c.due_date,
        status: "pending",
        message: `El expediente "${c.title}" vence el ${c.due_date}.`,
      });
      if (!insertError) created += 1;
    }

    return json({ checked: cases?.length ?? 0, created });
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
