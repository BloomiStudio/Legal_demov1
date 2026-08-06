// Revisa expedientes con requisitos pendientes (del checklist aprobado
// para su tipo de acto) y notifica al responsable y a los administradores
// relevantes. Pensada para un Cron Job de Supabase, igual que
// check-deadlines.
//
// El aviso al cliente final (cases.notify_client_on_missing_docs) todavía
// NO envía un correo real: no hay proveedor de correo conectado. Por ahora
// sólo se deja constancia en audit_log para que activar un proveedor real
// (Resend, SendGrid, etc.) más adelante sea un cambio aislado a esta
// función, sin tocar el resto del esquema.
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseClients.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const admin = createAdminClient();

    const { data: pendingRows, error } = await admin
      .from("case_requirement_status")
      .select("case_id, requirement:document_requirements(label, is_required)")
      .eq("status", "pending");
    if (error) return json({ error: error.message }, 500);

    const caseIdsWithMissingRequired = new Set(
      (pendingRows ?? []).filter((r) => r.requirement?.is_required).map((r) => r.case_id)
    );
    if (caseIdsWithMissingRequired.size === 0) return json({ notified: 0 });

    const { data: cases } = await admin
      .from("cases")
      .select("id, title, department_id, responsible_user_id, notify_client_on_missing_docs, organization_id")
      .in("id", Array.from(caseIdsWithMissingRequired))
      .in("status", ["open", "in_progress"]);

    let notified = 0;

    for (const c of cases ?? []) {
      const missingLabels = (pendingRows ?? [])
        .filter((r) => r.case_id === c.id && r.requirement?.is_required)
        .map((r) => r.requirement!.label);
      if (missingLabels.length === 0) continue;

      const { data: alreadyNotified } = await admin
        .from("notifications")
        .select("id")
        .eq("case_id", c.id)
        .eq("type", "missing_requirements")
        .eq("is_read", false)
        .limit(1)
        .maybeSingle();
      if (alreadyNotified) continue; // ya hay un aviso sin leer, no duplicar

      const { data: admins } = await admin
        .from("profiles")
        .select("id")
        .eq("organization_id", c.organization_id)
        .or(`role.eq.administrador,and(is_department_admin.eq.true,department_id.eq.${c.department_id})`);

      const recipientIds = new Set<string>();
      if (c.responsible_user_id) recipientIds.add(c.responsible_user_id);
      for (const a of admins ?? []) recipientIds.add(a.id);

      const title = `Faltan documentos: ${c.title}`;
      const message = `Este expediente tiene requisitos pendientes: ${missingLabels.join(", ")}.`;

      const { error: insertError } = await admin.from("notifications").insert(
        Array.from(recipientIds).map((recipientId) => ({
          organization_id: c.organization_id,
          recipient_user_id: recipientId,
          case_id: c.id,
          type: "missing_requirements",
          title,
          message,
        }))
      );
      if (!insertError) notified += recipientIds.size;

      if (c.notify_client_on_missing_docs) {
        await admin.from("audit_log").insert({
          actor_id: null,
          action: "client_notification_stubbed",
          entity_type: "cases",
          entity_id: c.id,
          metadata: { missing: missingLabels, reason: "sin proveedor de correo configurado todavía" },
        });
      }
    }

    return json({ notified });
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
