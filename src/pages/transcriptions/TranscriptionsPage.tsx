import { useEffect, useState } from "react";
import { FileSearch, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Case, Transcription } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TRANSCRIPTION_STATUS_LABELS } from "@/lib/constants";

export function TranscriptionsPage() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [caseId, setCaseId] = useState<string>("none");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<Transcription | null>(null);

  async function load() {
    const [tRes, cRes] = await Promise.all([
      supabase.from("transcriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("cases").select("*").order("title"),
    ]);
    setTranscriptions((tRes.data as Transcription[]) ?? []);
    setCases((cRes.data as Case[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${caseId === "none" ? "sin-expediente" : caseId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("uploads").upload(path, file);
    if (uploadError) {
      setUploading(false);
      return toast.error("No se pudo subir el archivo", { description: uploadError.message });
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke("transcribe-ocr", {
      body: { storage_path: path, case_id: caseId === "none" ? null : caseId },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
    setUploading(false);
    if (error) return toast.error("No se pudo iniciar la transcripción", { description: error.message });
    toast.success("Transcripción en proceso");
    load();
    event.target.value = "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transcripciones / OCR</h1>
        <p className="text-muted-foreground">Extrae texto de PDFs escaneados, identificaciones o contratos con IA.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subir documento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-64 space-y-2">
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Expediente (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin expediente asociado</SelectItem>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label>
            <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button asChild disabled={uploading}>
              <span>
                <Upload className="mr-2 h-4 w-4" /> {uploading ? "Subiendo…" : "Subir PDF"}
              </span>
            </Button>
          </label>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {transcriptions.length === 0 && <p className="text-sm text-muted-foreground">Sin transcripciones todavía.</p>}
        {transcriptions.map((t) => (
          <button
            key={t.id}
            onClick={() => setViewing(t)}
            className="flex w-full items-center justify-between rounded-md border bg-card p-3 text-left text-sm hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{t.source_storage_path.split("/").pop()}</span>
            </div>
            <Badge variant="outline">{TRANSCRIPTION_STATUS_LABELS[t.status]}</Badge>
          </button>
        ))}
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[80vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Texto extraído</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {viewing?.status !== "completed" && (
              <p className="text-sm text-muted-foreground">
                {viewing?.status === "failed" ? viewing.error_message ?? "La transcripción falló." : "Aún procesando…"}
              </p>
            )}
            {viewing?.extracted_text?.map((page) => (
              <div key={page.page} className="mb-4">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Página {page.page}</p>
                <p className="whitespace-pre-wrap text-sm">{page.text}</p>
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
