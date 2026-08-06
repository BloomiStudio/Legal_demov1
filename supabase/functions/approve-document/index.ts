// Aprueba o rechaza un documento generado por IA. Es el ÚNICO lugar donde
// documents.review_status puede pasar de "ai_draft" a "approved"/"rejected"
// (el trigger guard_document_review_status en la base de datos lo exige).
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabaseClients.ts";

const APPROVER_ROLES = ["notario", "abogado", "administrador"];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Falta el header Authorization" }, 401);

    const { document_id, decision } = await req.json();
    if (!document_id || !["approved", "rejected"].includes(decision)) {
      return json({ error: "document_id y decision ('approved' | 'rejected') son requeridos" }, 400);
    }

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await userClient.from("profiles").select("*").eq("id", userId).single();
    if (!profile || !APPROVER_ROLES.includes(profile.role)) {
      return json({ error: "Tu rol no puede aprobar documentos generados por IA" }, 403);
    }

    // RLS decide si este usuario puede ver el documento (y por lo tanto el
    // expediente al que pertenece); si no, esta consulta regresa null.
    const { data: document } = await userClient.from("documents").select("*").eq("id", document_id).single();
    if (!document) return json({ error: "No tienes acceso a este documento" }, 404);
    if (document.review_status !== "ai_draft") {
      return json({ error: `Este documento ya está en estado '${document.review_status}'` }, 409);
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: updatedDocument, error: updateError } = await admin
      .from("documents")
      .update({ review_status: decision, approved_by: userId, approved_at: now })
      .eq("id", document_id)
      .select()
      .single();
    if (updateError) return json({ error: updateError.message }, 500);

    await admin
      .from("ai_generations")
      .update({ approval_status: decision, approved_by: userId, approved_at: now })
      .eq("document_id", document_id);

    await admin.from("audit_log").insert({
      actor_id: userId,
      action: decision === "approved" ? "ai_approve" : "ai_reject",
      entity_type: "documents",
      entity_id: document_id,
      metadata: { case_id: document.case_id, decision },
    });

    return json({ document: updatedDocument });
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
