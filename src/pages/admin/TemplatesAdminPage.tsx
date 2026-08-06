import { useEffect, useState, type FormEvent } from "react";
import { Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useActTypes } from "@/hooks/useLookups";
import type { DocumentRequirement, Template, TemplateExample } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TemplatesAdminPage() {
  const { profile, isAdmin } = useAuth();
  const actTypes = useActTypes();
  const [actTypeId, setActTypeId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [examples, setExamples] = useState<TemplateExample[]>([]);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    if (!actTypeId && actTypes.length) setActTypeId(actTypes[0].id);
  }, [actTypes, actTypeId]);

  async function loadTemplates() {
    if (!actTypeId) return;
    const { data } = await supabase.from("templates").select("*").eq("act_type_id", actTypeId).order("name");
    const list = (data as Template[]) ?? [];
    setTemplates(list);
    if (!list.find((t) => t.id === selectedTemplateId)) setSelectedTemplateId(list[0]?.id ?? null);
  }

  async function loadExamples() {
    if (!selectedTemplateId) return setExamples([]);
    const { data } = await supabase.from("template_examples").select("*").eq("template_id", selectedTemplateId);
    setExamples((data as TemplateExample[]) ?? []);
  }

  async function loadRequirements() {
    if (!actTypeId) return;
    const { data } = await supabase
      .from("document_requirements")
      .select("*")
      .eq("act_type_id", actTypeId)
      .order("created_at", { ascending: false });
    setRequirements((data as DocumentRequirement[]) ?? []);
  }

  useEffect(() => {
    loadTemplates();
    loadRequirements();
  }, [actTypeId]);

  useEffect(() => {
    loadExamples();
  }, [selectedTemplateId]);

  async function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.organization_id) return;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("templates").insert({
      organization_id: profile.organization_id,
      act_type_id: actTypeId,
      name: String(form.get("name")),
      content: String(form.get("content")),
      created_by: profile.id,
    });
    if (error) return toast.error("No se pudo crear la plantilla", { description: error.message });
    toast.success("Plantilla creada");
    (event.target as HTMLFormElement).reset();
    loadTemplates();
  }

  async function handleUploadExample(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedTemplateId || !profile) return;
    const path = `${selectedTemplateId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) return toast.error("No se pudo subir el ejemplo", { description: uploadError.message });
    const { error } = await supabase
      .from("template_examples")
      .insert({ template_id: selectedTemplateId, storage_path: path, label: file.name, created_by: profile.id });
    if (error) return toast.error("No se pudo registrar el ejemplo", { description: error.message });
    loadExamples();
  }

  async function removeExample(id: string) {
    const { error } = await supabase.from("template_examples").delete().eq("id", id);
    if (error) return toast.error("No se pudo quitar", { description: error.message });
    loadExamples();
  }

  async function proposeRequirements() {
    if (!actTypeId) return;
    setProposing(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke("propose-requirements", {
      body: { act_type_id: actTypeId },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
    setProposing(false);
    if (error) return toast.error("No se pudo generar el checklist", { description: error.message });
    toast.success("La IA propuso un checklist, revísalo abajo");
    loadRequirements();
  }

  async function updateRequirement(id: string, patch: Partial<DocumentRequirement>) {
    const { error } = await supabase.from("document_requirements").update(patch).eq("id", id);
    if (error) return toast.error("No se pudo actualizar", { description: error.message });
    loadRequirements();
  }

  async function handleAddRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.organization_id) return;
    const form = new FormData(event.currentTarget);
    const label = String(form.get("label") || "").trim();
    if (!label) return;
    const { error } = await supabase.from("document_requirements").insert({
      organization_id: profile.organization_id,
      act_type_id: actTypeId,
      label,
      status: "approved",
      source: "admin",
      created_by: profile.id,
    });
    if (error) return toast.error("No se pudo agregar", { description: error.message });
    (event.target as HTMLFormElement).reset();
    loadRequirements();
  }

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Sólo un administrador general puede configurar plantillas y checklist.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plantillas y requisitos por tipo de acto</h1>
        <p className="text-muted-foreground">
          Sube la plantilla y ejemplos de cada tipo de acto, y cura el checklist de información/documentos que la IA propone.
        </p>
      </div>

      <div className="w-64">
        <Select value={actTypeId} onValueChange={setActTypeId}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo de acto" />
          </SelectTrigger>
          <SelectContent>
            {actTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plantillas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`block w-full rounded-md border p-2 text-left text-sm ${selectedTemplateId === t.id ? "border-primary" : ""}`}
                >
                  {t.name}
                </button>
              ))}
              {templates.length === 0 && <p className="text-sm text-muted-foreground">Sin plantillas todavía.</p>}
            </div>

            <NewTemplateDialog onSubmit={handleCreateTemplate} />

            {selectedTemplateId && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Ejemplos de referencia</Label>
                  <label>
                    <Input type="file" className="hidden" onChange={handleUploadExample} />
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="mr-2 h-3 w-3" /> Subir ejemplo
                      </span>
                    </Button>
                  </label>
                </div>
                {examples.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate">{e.label}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeExample(e.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                {examples.length === 0 && <p className="text-xs text-muted-foreground">Sin ejemplos todavía.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Checklist de requisitos</CardTitle>
            <Button size="sm" onClick={proposeRequirements} disabled={proposing || templates.length === 0}>
              <Sparkles className="mr-2 h-3 w-3" /> {proposing ? "Generando…" : "Generar con IA"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {requirements.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin requisitos todavía. Genera una propuesta con IA o agrega uno manual.</p>
            )}
            {requirements.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{r.label}</p>
                  <div className="mt-1 flex gap-1">
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                      {r.status === "approved" ? "Aprobado" : r.status === "rejected" ? "Rechazado" : "Sugerido por IA"}
                    </Badge>
                    {!r.is_required && <Badge variant="outline">Opcional</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {r.status !== "approved" && (
                    <Button variant="ghost" size="sm" onClick={() => updateRequirement(r.id, { status: "approved" })}>
                      Aprobar
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button variant="ghost" size="sm" onClick={() => updateRequirement(r.id, { status: "rejected" })}>
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <form onSubmit={handleAddRequirement} className="flex gap-2 border-t pt-3">
              <Input name="label" placeholder="Agregar requisito manual…" />
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NewTemplateDialog({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Nueva plantilla
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(e) => {
            onSubmit(e);
            setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required placeholder="Ej. Compraventa estándar" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Contenido (usa placeholders {"{{así}}"})</Label>
              <Textarea id="content" name="content" required rows={10} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
