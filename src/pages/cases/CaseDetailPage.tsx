import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { ActType, Case, Department, Profile } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseFormDialog } from "@/components/cases/CaseFormDialog";
import { CasePartiesSection } from "@/components/cases/CasePartiesSection";
import { CaseDocumentsSection } from "@/components/cases/CaseDocumentsSection";
import { CaseCommentsSection } from "@/components/cases/CaseCommentsSection";
import { CaseRequirementsSection } from "@/components/cases/CaseRequirementsSection";
import { CASE_STATUS_BADGE, CASE_STATUS_LABELS } from "@/lib/constants";
import type { CaseStatus } from "@/lib/database.types";

type CaseDetail = Case & { act_type: ActType | null; department: Department | null; responsible: Profile | null };

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<CaseDetail | null>(null);

  async function load() {
    if (!caseId) return;
    const { data, error } = await supabase
      .from("cases")
      .select("*, act_type:act_types(*), department:departments(*), responsible:profiles!cases_responsible_user_id_fkey(*)")
      .eq("id", caseId)
      .single();
    if (error) {
      toast.error("No se pudo cargar el expediente", { description: error.message });
      return;
    }
    setCaseItem(data as CaseDetail);
  }

  useEffect(() => {
    load();
  }, [caseId]);

  async function handleStatusChange(status: CaseStatus) {
    if (!caseId) return;
    const { error } = await supabase.from("cases").update({ status }).eq("id", caseId);
    if (error) return toast.error("No se pudo cambiar el estado", { description: error.message });
    load();
  }

  async function handleNotifyClientChange(value: boolean) {
    if (!caseId) return;
    const { error } = await supabase.from("cases").update({ notify_client_on_missing_docs: value }).eq("id", caseId);
    if (error) return toast.error("No se pudo actualizar", { description: error.message });
    load();
  }

  if (!caseItem) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/expedientes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{caseItem.title}</h1>
            <p className="text-muted-foreground">{caseItem.act_type?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={caseItem.status} onValueChange={(v) => handleStatusChange(v as CaseStatus)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CaseFormDialog
            caseItem={caseItem}
            onSaved={load}
            trigger={
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Estado" value={<Badge variant={CASE_STATUS_BADGE[caseItem.status]}>{CASE_STATUS_LABELS[caseItem.status]}</Badge>} />
        <InfoCard label="Departamento" value={caseItem.department?.name ?? "—"} />
        <InfoCard label="Responsable" value={caseItem.responsible?.full_name ?? "Sin asignar"} />
        <InfoCard label="Fecha límite" value={caseItem.due_date ?? "Sin definir"} />
      </div>

      {caseItem.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{caseItem.notes}</CardContent>
        </Card>
      )}

      <Tabs defaultValue="requisitos">
        <TabsList>
          <TabsTrigger value="requisitos">Requisitos</TabsTrigger>
          <TabsTrigger value="comparecientes">Comparecientes</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="comentarios">Comentarios</TabsTrigger>
        </TabsList>
        <TabsContent value="requisitos" className="mt-4">
          <CaseRequirementsSection
            caseId={caseItem.id}
            notifyClient={caseItem.notify_client_on_missing_docs}
            onNotifyClientChange={handleNotifyClientChange}
          />
        </TabsContent>
        <TabsContent value="comparecientes" className="mt-4">
          <CasePartiesSection caseId={caseItem.id} />
        </TabsContent>
        <TabsContent value="documentos" className="mt-4">
          <CaseDocumentsSection caseId={caseItem.id} actTypeId={caseItem.act_type_id} />
        </TabsContent>
        <TabsContent value="comentarios" className="mt-4">
          <CaseCommentsSection caseId={caseItem.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-1 text-sm font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}
