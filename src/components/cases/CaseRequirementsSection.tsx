import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { CaseRequirementStatus, DocumentRequirement } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type RequirementRow = CaseRequirementStatus & { requirement: DocumentRequirement };

export function CaseRequirementsSection({
  caseId,
  notifyClient,
  onNotifyClientChange,
}: {
  caseId: string;
  notifyClient: boolean;
  onNotifyClientChange: (value: boolean) => void;
}) {
  const { isAdmin, profile } = useAuth();
  const [rows, setRows] = useState<RequirementRow[]>([]);

  async function load() {
    const { data } = await supabase
      .from("case_requirement_status")
      .select("*, requirement:document_requirements(*)")
      .eq("case_id", caseId);
    setRows(((data as RequirementRow[]) ?? []).sort((a, b) => a.requirement.label.localeCompare(b.requirement.label)));
  }

  useEffect(() => {
    load();
  }, [caseId]);

  const canToggleManually = isAdmin || profile?.document_permission === "create" || profile?.document_permission === "edit";

  async function toggle(row: RequirementRow) {
    if (!canToggleManually) return;
    const nextStatus = row.status === "fulfilled" ? "pending" : "fulfilled";
    const { error } = await supabase
      .from("case_requirement_status")
      .update({
        status: nextStatus,
        fulfilled_at: nextStatus === "fulfilled" ? new Date().toISOString() : null,
        fulfilled_document_id: nextStatus === "fulfilled" ? row.fulfilled_document_id : null,
      })
      .eq("id", row.id);
    if (error) return toast.error("No se pudo actualizar el requisito", { description: error.message });
    load();
  }

  const missing = rows.filter((r) => r.status === "pending" && r.requirement.is_required);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Requisitos del tipo de acto</CardTitle>
        {missing.length === 0 ? (
          <Badge>Completo</Badge>
        ) : (
          <Badge variant="secondary">{missing.length} pendiente(s)</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Este tipo de acto todavía no tiene un checklist de requisitos aprobado. Un administrador puede generarlo con IA en
            Administración.
          </p>
        )}
        {rows.map((row) => (
          <button
            key={row.id}
            onClick={() => toggle(row)}
            disabled={!canToggleManually}
            className="flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm disabled:cursor-default"
          >
            {row.status === "fulfilled" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {row.requirement.label}
                {!row.requirement.is_required && <span className="ml-2 text-xs text-muted-foreground">(opcional)</span>}
              </p>
              {row.requirement.description && <p className="text-muted-foreground">{row.requirement.description}</p>}
            </div>
          </button>
        ))}

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="notify-client">Avisar también al cliente final</Label>
            <p className="text-xs text-muted-foreground">Si faltan requisitos, además del equipo se le notifica a él para que los provea.</p>
          </div>
          <Switch id="notify-client" checked={notifyClient} onCheckedChange={onNotifyClientChange} />
        </div>
      </CardContent>
    </Card>
  );
}
