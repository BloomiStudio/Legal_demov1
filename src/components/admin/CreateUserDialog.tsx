import { useState, type FormEvent } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useDepartments } from "@/hooks/useLookups";
import type { AppRole, DocumentPermission, VisibilityScope } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { DOCUMENT_PERMISSION_LABELS, ROLE_LABELS, VISIBILITY_SCOPE_LABELS } from "@/lib/constants";

export function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const { departments } = useDepartments();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ email: string; temporary_password: string } | null>(null);

  const [role, setRole] = useState<AppRole>("asistente");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [isDepartmentAdmin, setIsDepartmentAdmin] = useState(false);
  const [documentPermission, setDocumentPermission] = useState<DocumentPermission>("read");
  const [canComment, setCanComment] = useState(false);
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>("department");

  function resetForm() {
    setResult(null);
    setRole("asistente");
    setDepartmentId("none");
    setIsDepartmentAdmin(false);
    setDocumentPermission("read");
    setCanComment(false);
    setVisibilityScope("department");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email: String(form.get("email")),
        full_name: String(form.get("full_name")),
        role,
        department_id: departmentId === "none" ? null : departmentId,
        is_department_admin: isDepartmentAdmin,
        document_permission: documentPermission,
        can_comment: canComment,
        case_visibility_scope: visibilityScope,
      },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });

    setSubmitting(false);
    if (error) return toast.error("No se pudo crear el usuario", { description: error.message });
    setResult({ email: data.email, temporary_password: data.temporary_password });
    onCreated();
  }

  function copyPassword() {
    if (!result) return;
    navigator.clipboard.writeText(result.temporary_password);
    toast.success("Contraseña copiada");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {result ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Cuenta creada</DialogTitle>
              <DialogDescription>Comparte esta contraseña temporal por un canal seguro — no se volverá a mostrar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Correo:</span> {result.email}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Contraseña temporal:</span>
                <code className="rounded bg-background px-2 py-1 font-mono">{result.temporary_password}</code>
                <Button variant="ghost" size="icon" onClick={copyPassword}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
              <DialogDescription>Se crea la cuenta con una contraseña temporal que se muestra una sola vez.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre completo</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin departamento</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="dept-admin">Administrador de su departamento</Label>
                <Switch id="dept-admin" checked={isDepartmentAdmin} onCheckedChange={setIsDepartmentAdmin} />
              </div>

              <div className="space-y-2">
                <Label>Permiso de documentos</Label>
                <Select value={documentPermission} onValueChange={(v) => setDocumentPermission(v as DocumentPermission)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_PERMISSION_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="can-comment">Puede comentar en expedientes</Label>
                <Switch id="can-comment" checked={canComment} onCheckedChange={setCanComment} />
              </div>

              <div className="space-y-2">
                <Label>Visibilidad de expedientes</Label>
                <Select value={visibilityScope} onValueChange={(v) => setVisibilityScope(v as VisibilityScope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISIBILITY_SCOPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                Crear usuario
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
