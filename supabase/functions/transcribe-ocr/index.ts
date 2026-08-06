// Extrae texto estructurado (por página) de un PDF subido a Storage,
// usando la API de Claude. El archivo nunca sale de Storage/Anthropic: no
// se registra su contenido en logs.
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabaseClients.ts";
import { callClaude } from "../_shared/anthropic.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Falta el header Authorization" }, 401);

    const { storage_path, case_id } = await req.json();
    if (!storage_path) return json({ error: "storage_path es requerido" }, 400);

    const userClient = createUserClient(authHeader);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    if (case_id) {
      const { data: caseRow } = await userClient.from("cases").select("id").eq("id", case_id).single();
      if (!caseRow) return json({ error: "No tienes acceso a ese expediente" }, 403);
    }

    const admin = createAdminClient();

    const { data: transcription, error: insertError } = await admin
      .from("transcriptions")
      .insert({ case_id: case_id ?? null, source_storage_path: storage_path, status: "processing", requested_by: userId })
      .select()
      .single();
    if (insertError) return json({ error: insertError.message }, 500);

    try {
      const { data: fileBlob, error: downloadError } = await admin.storage.from("uploads").download(storage_path);
      if (downloadError || !fileBlob) throw new Error(downloadError?.message ?? "No se pudo descargar el archivo");

      const base64 = encodeBase64(await fileBlob.arrayBuffer());

      const output = await callClaude({
        system:
          "Extraes texto de documentos PDF (identificaciones, contratos, escrituras escaneadas). " +
          "Respondes ÚNICAMENTE con JSON válido: un arreglo de objetos {\"page\": number, \"text\": string}, uno por página. Sin comentarios ni texto fuera del JSON.",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: "Extrae el texto de cada página de este documento." },
        ],
      });

      const extractedText = parsePages(output);

      const { data: completed, error: updateError } = await admin
        .from("transcriptions")
        .update({ status: "completed", extracted_text: extractedText })
        .eq("id", transcription.id)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);

      await admin.from("audit_log").insert({
        actor_id: userId,
        action: "ocr_transcribe",
        entity_type: "transcriptions",
        entity_id: transcription.id,
        metadata: { case_id, storage_path, pages: extractedText.length },
      });

      return json({ transcription: completed });
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : "Error al transcribir";
      await admin.from("transcriptions").update({ status: "failed", error_message: message }).eq("id", transcription.id);
      return json({ error: message }, 500);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Error inesperado" }, 500);
  }
});

function parsePages(output: string): { page: number; text: string }[] {
  try {
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : output);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // sigue abajo con el fallback
  }
  return [{ page: 1, text: output }];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
