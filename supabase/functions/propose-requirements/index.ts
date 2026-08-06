// La IA propone, para un tipo de acto, qué información y documentos de
// soporte hacen falta para armarlo (basándose en la plantilla y los
// ejemplos que el despacho compartió). Queda como checklist "suggested":
// un administrador general lo aprueba, edita o descarta antes de que
// cuente para el seguimiento de expedientes.
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabaseClients.ts";
import { callClaude } from "../_shared/anthropic.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Falta el header Authorization" }, 401);

    const { act_type_id } = await req.json();
    if (!act_type_id) return json({ error: "act_type_id es requerido" }, 400);

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await userClient.from("profiles").select("*").eq("id", userId).single();
    if (profile?.role !== "administrador") {
      return json({ error: "Sólo un administrador general puede generar el checklist de requisitos" }, 403);
    }

    const { data: actType } = await userClient.from("act_types").select("*").eq("id", act_type_id).single();
    if (!actType) return json({ error: "Tipo de acto no encontrado" }, 404);

    const admin = createAdminClient();

    const { data: templates } = await admin.from("templates").select("*").eq("act_type_id", act_type_id);
    const templateIds = (templates ?? []).map((t) => t.id);
    const { data: examples } = templateIds.length
      ? await admin.from("template_examples").select("*").in("template_id", templateIds)
      : { data: [] as { label: string | null; storage_path: string }[] };

    const prompt = [
      `Tipo de acto notarial: ${actType.name}.`,
      "Plantilla(s) disponibles:",
      ...(templates ?? []).map((t) => `--- ${t.name} ---\n${t.content}`),
      "",
      examples?.length
        ? `Ejemplos de referencia compartidos por el despacho: ${examples.map((e) => e.label ?? e.storage_path).join(", ")}.`
        : "No hay ejemplos de referencia todavía, básate sólo en la(s) plantilla(s).",
      "",
      "Enumera la información y los documentos de soporte que normalmente se necesitan para armar este acto en una notaría mexicana",
      "(ej. identificaciones oficiales, comprobantes, actas, poderes previos, avalúos, etc.).",
      "Responde ÚNICAMENTE con un arreglo JSON de objetos: " +
        '{"label": string, "description": string, "is_required": boolean}. Sin texto fuera del JSON.',
    ].join("\n");

    const output = await callClaude({
      system: "Analizas actos notariales mexicanos y listas los requisitos documentales típicos. Respondes sólo con JSON válido.",
      content: [{ type: "text", text: prompt }],
    });

    const items = parseItems(output);
    if (items.length === 0) return json({ error: "La IA no propuso requisitos; intenta de nuevo o agrégalos manualmente" }, 502);

    const { data: inserted, error: insertError } = await admin
      .from("document_requirements")
      .insert(
        items.map((item) => ({
          organization_id: profile.organization_id,
          act_type_id,
          label: item.label,
          description: item.description ?? null,
          is_required: item.is_required ?? true,
          status: "suggested",
          source: "ai",
        }))
      )
      .select();
    if (insertError) return json({ error: insertError.message }, 500);

    await admin.from("audit_log").insert({
      actor_id: userId,
      action: "ai_propose_requirements",
      entity_type: "document_requirements",
      entity_id: null,
      metadata: { act_type_id, count: inserted?.length ?? 0 },
    });

    return json({ requirements: inserted });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});

function parseItems(output: string): { label: string; description?: string; is_required?: boolean }[] {
  try {
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : output);
    if (Array.isArray(parsed)) return parsed.filter((i) => typeof i?.label === "string");
  } catch {
    // sin fallback razonable: mejor regresar vacío y que el llamador lo reporte
  }
  return [];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
