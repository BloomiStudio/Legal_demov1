import { useEffect, useState } from "react";
import { CheckCircle2, Download, FileType, Sparkles, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { ActType, CaseRequirementStatus, Document, DocumentRequirement, Template } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_REVIEW_LABELS } from "@/lib/constants";

const REVIEW_BADGE: Record<Document["review_status"], "default" | "secondary" | "outline" | "destructive"> = {
  ai_draft: "secondary",
  in_review: "outline",
  approved: "default",
  rejected: "destructive",
};

type PendingRequirement = CaseRequirementStatus & { requirement: DocumentRequirement };

export function CaseDocumentsSection({ caseId, actTypeId }: { caseId: string; actTypeId: string }) {
  const { profile, canApproveDocuments } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [missingRequired, setMissingRequired] = useState<PendingRequirement[]>([]);
  const [pendingRequirementsForUpload, setPendingRequirementsForUpload] = useState<PendingRequirement[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [uploadRequirementId, setUploadRequirementId] = useState("none");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canCreate = profile?.document_permission === "create" || profile?.document_permission === "edit";
  const canEdit = profile?.document_permission === "edit";

  async function load() {
    const [docsRes, templatesRes, pendingRes] = await Promise.all([
      supabase.from("documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      supabase.from("templates").select("*").eq("act_type_id", actTypeId).eq("is_active", true),
      supabase
        .from("case_requirement_status")
        .select("*, requirement:document_requirements(*)")
        .eq("case_id", caseId)
        .eq("status", "pending"),
    ]);
    setDocuments((docsRes.data as Document[]) ?? []);
    setTemplates((templatesRes.data as Template[]) ?? []);
    const pending = (pendingRes.data as PendingRequirement[]) ?? [];
    setPendingRequirementsForUpload(pending);
    setMissingRequired(pending.filter((r) => r.requirement.is_required));
  }

  useEffect(() => {
    load();
  }, [caseId, actTypeId]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const path = `${caseId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      setUploading(false);
      return toast.error("No se pudo subir el archivo", { description: uploadError.message });
    }
    const { error } = await supabase.from("documents").insert({
      case_id: caseId,
      document_type: "escritura",
      storage_path: path,
      uploaded_by: profile.id,
      generated_by_ai: false,
      review_status: "approved",
      requirement_id: uploadRequirementId === "none" ? null : uploadRequirementId,
    });
    setUploading(false);
    if (error) return toast.error("No se pudo registrar el documento", { description: error.message });
    toast.success("Documento subido");
    setUploadRequirementId("none");
    load();
  }

  async function handleGenerate() {
    if (!templateId) return toast.error("Selecciona una plantilla");
    setGenerating(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke("generate-document", {
      body: { case_id: caseId, template_id: templateId },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
    setGenerating(false);
    if (error) return toast.error("No se pudo generar el borrador", { description: error.message });
    toast.success("Borrador generado, pendiente de revisión");
    load();
  }

  async function handleReview(documentId: string, decision: "approved" | "rejected") {
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke("approve-document", {
      body: { document_id: documentId, decision },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
    if (error) return toast.error("No se pudo procesar la revisión", { description: error.message });
    toast.success(decision === "approved" ? "Documento aprobado" : "Documento rechazado");
    load();
  }

  async function downloadFile(path: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) return toast.error("No se pudo generar el enlace de descarga");
    window.open(data.signedUrl, "_blank");
  }

  const canGenerate = canCreate && missingRequired.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generar borrador con IA</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-64 space-y-2">
            <Select value={templateId} onValueChange={setTemplateId} disabled={!canGenerate}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una plantilla…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating || !canGenerate}>
            <Sparkles className="mr-2 h-4 w-4" /> {generating ? "Generando…" : "Generar borrador"}
          </Button>
          {!canCreate && <p className="text-sm text-muted-foreground">No tienes permiso para crear documentos.</p>}
          {templates.length === 0 && <p className="text-sm text-muted-foreground">No hay plantillas activas para este tipo de acto.</p>}
          {missingRequired.length > 0 && (
            <p className="w-full text-sm text-amber-600">
              Faltan requisitos antes de poder generar: {missingRequired.map((r) => r.requirement.label).join(", ")} (ver
              pestaña Requisitos).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Documentos</CardTitle>
          {canEdit && (
            <div className="flex items-center gap-2">
              {pendingRequirementsForUpload.length > 0 && (
                <Select value={uploadRequirementId} onValueChange={setUploadRequirementId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Satisface un requisito (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin requisito específico</SelectItem>
                    {pendingRequirementsForUpload.map((r) => (
                      <SelectItem key={r.id} value={r.requirement_id}>
                        {r.requirement.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <label>
                <Input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" /> {uploading ? "Subiendo…" : "Subir archivo"}
                  </span>
                </Button>
              </label>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">Sin documentos todavía.</p>}
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {doc.document_type} <span className="text-muted-foreground">v{doc.version}</span>
                </p>
                <Badge variant={REVIEW_BADGE[doc.review_status]} className="mt-1">
                  {DOCUMENT_REVIEW_LABELS[doc.review_status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => downloadFile(doc.storage_path)} title="Descargar (Word)">
                  <Download className="h-4 w-4" />
                </Button>
                {doc.storage_path_pdf && (
                  <Button variant="ghost" size="icon" onClick={() => downloadFile(doc.storage_path_pdf!)} title="Descargar (PDF)">
                    <FileType className="h-4 w-4" />
                  </Button>
                )}
                {canApproveDocuments && doc.review_status === "ai_draft" && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleReview(doc.id, "approved")} title="Aprobar">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleReview(doc.id, "rejected")} title="Rechazar">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {templates.length === 0 && <ActTypeHint actTypeId={actTypeId} />}
    </div>
  );
}

function ActTypeHint({ actTypeId }: { actTypeId: string }) {
  const [actType, setActType] = useState<ActType | null>(null);
  useEffect(() => {
    supabase
      .from("act_types")
      .select("*")
      .eq("id", actTypeId)
      .single()
      .then(({ data }) => setActType(data as ActType));
  }, [actTypeId]);

  if (!actType) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Crea una plantilla para "{actType.name}" en Administración para poder generar borradores con IA.
    </p>
  );
}
