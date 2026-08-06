// Genera un borrador de documento con IA a partir de una plantilla y los
// datos capturados en un expediente. El documento SIEMPRE se crea en
// estado "ai_draft" (pendiente de revisión humana) — aprobarlo es
// responsabilidad exclusiva de approve-document. No se puede generar
// mientras falten requisitos obligatorios del checklist del tipo de acto.
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabaseClients.ts";
import { callClaude } from "../_shared/anthropic.ts";
import { buildDocx, buildPdf } from "../_shared/documentBuilders.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Falta el header Authorization" }, 401);

    const { case_id, template_id } = await req.json();
    if (!case_id || !template_id) return json({ error: "case_id y template_id son requeridos" }, 400);

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    // RLS decide si este usuario puede ver el expediente y la plantilla;
    // si no puede, estas consultas regresan null y cortamos aquí.
    const { data: caseRow } = await userClient.from("cases").select("*").eq("id", case_id).single();
    if (!caseRow) return json({ error: "No tienes acceso a este expediente" }, 403);

    const { data: profile } = await userClient.from("profiles").select("*").eq("id", userId).single();
    const canCreate = profile?.role === "administrador" || profile?.document_permission === "create" || profile?.document_permission === "edit";
    if (!canCreate) return json({ error: "No tienes permiso para generar documentos" }, 403);

    const { data: template } = await userClient.from("templates").select("*").eq("id", template_id).single();
    if (!template) return json({ error: "Plantilla no encontrada" }, 404);

    const admin = createAdminClient();

    // Checklist: no se genera el documento final mientras falte un
    // requisito obligatorio aprobado para este tipo de acto.
    const { data: pendingRequirements } = await admin
      .from("case_requirement_status")
      .select("requirement:document_requirements(label, is_required)")
      .eq("case_id", case_id)
      .eq("status", "pending");
    const missingRequired = (pendingRequirements ?? [])
      .filter((r) => r.requirement?.is_required)
      .map((r) => r.requirement!.label);
    if (missingRequired.length > 0) {
      return json({ error: `Faltan requisitos antes de generar: ${missingRequired.join(", ")}` }, 409);
    }

    const [{ data: caseClients }, { data: caseParties }, { data: examples }] = await Promise.all([
      admin.from("case_clients").select("role_in_case, client:clients(*)").eq("case_id", case_id),
      admin.from("case_parties").select("*").eq("case_id", case_id),
      admin.from("template_examples").select("label, storage_path").eq("template_id", template_id),
    ]);

    const inputData = {
      case: { title: caseRow.title, opened_at: caseRow.opened_at, due_date: caseRow.due_date, notes: caseRow.notes },
      clients: caseClients,
      parties: caseParties,
    };

    const prompt = [
      "Eres un asistente legal que redacta borradores de documentos notariales en español mexicano.",
      "Usa la siguiente plantilla y sustituye los placeholders {{...}} con los datos proporcionados.",
      "Si un dato no está disponible, deja el placeholder marcado como [FALTA: nombre_del_dato] en vez de inventar información.",
      "Responde únicamente con el texto del documento, sin comentarios adicionales.",
      "",
      "--- PLANTILLA ---",
      template.content,
      "",
      examples?.length
        ? `--- EJEMPLOS DE REFERENCIA DEL DESPACHO (sigue su estilo y formato) ---\n${examples.map((e) => `- ${e.label ?? e.storage_path}`).join("\n")}`
        : "",
      "",
      "--- DATOS DEL EXPEDIENTE (JSON) ---",
      JSON.stringify(inputData, null, 2),
    ].join("\n");

    const output = await callClaude({
      system: "Redactas borradores notariales. Nunca declares un documento como final: siempre es un borrador sujeto a revisión humana.",
      content: [{ type: "text", text: prompt }],
    });

    const baseName = `${Date.now()}-borrador-${template.name.replace(/\s+/g, "_")}`;
    const [docxBytes, pdfBytes] = await Promise.all([buildDocx(output), buildPdf(output)]);

    const docxPath = `${case_id}/${baseName}.docx`;
    const pdfPath = `${case_id}/${baseName}.pdf`;

    const [docxUpload, pdfUpload] = await Promise.all([
      admin.storage.from("documents").upload(docxPath, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      admin.storage.from("documents").upload(pdfPath, pdfBytes, { contentType: "application/pdf" }),
    ]);
    if (docxUpload.error) return json({ error: `No se pudo guardar el borrador (Word): ${docxUpload.error.message}` }, 500);
    if (pdfUpload.error) return json({ error: `No se pudo guardar el borrador (PDF): ${pdfUpload.error.message}` }, 500);

    const { data: document, error: docError } = await admin
      .from("documents")
      .insert({
        case_id,
        document_type: template.name,
        review_status: "ai_draft",
        generated_by_ai: true,
        storage_path: docxPath,
        storage_path_pdf: pdfPath,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (docError) return json({ error: docError.message }, 500);

    const { data: generation, error: genError } = await admin
      .from("ai_generations")
      .insert({
        case_id,
        document_id: document.id,
        template_id,
        input_data: inputData,
        prompt_used: prompt,
        output,
        approval_status: "pending",
        requested_by: userId,
      })
      .select()
      .single();
    if (genError) return json({ error: genError.message }, 500);

    await admin.from("audit_log").insert({
      actor_id: userId,
      action: "ai_generate",
      entity_type: "ai_generations",
      entity_id: generation.id,
      metadata: { case_id, template_id, document_id: document.id },
    });

    return json({ document, generation });
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
