import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useActTypes, useDepartments, useOrgProfiles } from "@/hooks/useLookups";
import type { Case } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CaseFormDialogProps {
  caseItem?: Case;
  trigger: React.ReactNode;
  onSaved?: (caseId: string) => void;
}

export function CaseFormDialog({ caseItem, trigger, onSaved }: CaseFormDialogProps) {
  const { profile, isAdmin } = useAuth();
  const actTypes = useActTypes();
  const { departments } = useDepartments();
  const profiles = useOrgProfiles();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canPickDepartment = isAdmin || Boolean(profile?.is_department_admin);
  const canAssignResponsible = isAdmin || Boolean(profile?.is_department_admin);

  const [actTypeId, setActTypeId] = useState(caseItem?.act_type_id ?? "");
  const [departmentId, setDepartmentId] = useState(caseItem?.department_id ?? profile?.department_id ?? "");
  const [responsibleId, setResponsibleId] = useState(caseItem?.responsible_user_id ?? profile?.id ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.organization_id || !actTypeId) {
      if (!actTypeId) toast.error("Selecciona un tipo de acto");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSubmitting(true);

    const payload = {
      organization_id: profile.organization_id,
      department_id: canPickDepartment ? departmentId : profile.department_id,
      act_type_id: actTypeId,
      title: String(form.get("title")),
      due_date: String(form.get("due_date") || "") || null,
      notes: String(form.get("notes") || "") || null,
      ...(canAssignResponsible ? { responsible_user_id: responsibleId || null } : {}),
    };

    const { data, error } = caseItem
      ? await supabase.from("cases").update(payload).eq("id", caseItem.id).select().single()
      : await supabase.from("cases").insert({ ...payload, created_by: profile.id }).select().single();

    setSubmitting(false);
    if (error) {
      toast.error("No se pudo guardar el expediente", { description: error.message });
      return;
    }
    toast.success(caseItem ? "Expediente actualizado" : "Expediente creado");
    setOpen(false);
    if (onSaved) onSaved(data.id);
    if (!caseItem) navigate(`/expedientes/${data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{caseItem ? "Editar expediente" : "Nuevo expediente"}</DialogTitle>
            <DialogDescription>Datos generales del acto notarial.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Descripción corta</Label>
              <Input id="title" name="title" defaultValue={caseItem?.title} required placeholder="Ej. Compraventa Depto. 4B, Col. Roma" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de acto</Label>
                <Select value={actTypeId} onValueChange={setActTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
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

              <div className="space-y-2">
                <Label>Departamento</Label>
                {canPickDepartment ? (
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input disabled value={departments.find((d) => d.id === profile?.department_id)?.name ?? "Tu departamento"} />
                )}
              </div>
            </div>

            {canAssignResponsible && (
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Select value={responsibleId} onValueChange={setResponsibleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="due_date">Fecha límite</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={caseItem?.due_date ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" defaultValue={caseItem?.notes ?? ""} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
