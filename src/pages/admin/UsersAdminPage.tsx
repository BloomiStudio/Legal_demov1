import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useDepartments } from "@/hooks/useLookups";
import type { AppRole, DocumentPermission, Profile, VisibilityScope } from "@/lib/database.types";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DOCUMENT_PERMISSION_LABELS,
  ROLE_LABELS,
  VISIBILITY_SCOPE_LABELS,
} from "@/lib/constants";

export function UsersAdminPage() {
  const { profile: me, isAdmin, isDepartmentAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { departments } = useDepartments();

  async function load() {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    setProfiles((data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateProfile(id: string, patch: Partial<Profile>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return toast.error("No se pudo actualizar", { description: error.message });
    load();
  }

  function canManage(p: Profile) {
    if (isAdmin) return true;
    if (isDepartmentAdmin) return p.id !== me?.id && p.department_id === me?.department_id;
    return false;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios y permisos</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Como administrador general puedes gestionar rol, departamento y permisos de cualquier persona."
              : "Como administrador de tu departamento puedes ajustar permisos de documentos, comentarios y visibilidad para tu gente."}
          </p>
        </div>
        {isAdmin && <CreateUserDialog onCreated={load} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                {isAdmin && <TableHead>Rol</TableHead>}
                {isAdmin && <TableHead>Departamento</TableHead>}
                {isAdmin && <TableHead>Admin de depto.</TableHead>}
                <TableHead>Permiso de documentos</TableHead>
                <TableHead>Comentarios</TableHead>
                <TableHead>Visibilidad de expedientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const editable = canManage(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.full_name}
                      {p.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                    </TableCell>

                    {isAdmin && (
                      <TableCell>
                        <Select value={p.role} onValueChange={(v) => updateProfile(p.id, { role: v as AppRole })}>
                          <SelectTrigger className="w-40">
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
                      </TableCell>
                    )}

                    {isAdmin && (
                      <TableCell>
                        <Select
                          value={p.department_id ?? "none"}
                          onValueChange={(v) => updateProfile(p.id, { department_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="w-44">
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
                      </TableCell>
                    )}

                    {isAdmin && (
                      <TableCell>
                        <Switch
                          checked={p.is_department_admin}
                          onCheckedChange={(checked) => updateProfile(p.id, { is_department_admin: checked })}
                        />
                      </TableCell>
                    )}

                    <TableCell>
                      <Select
                        value={p.document_permission}
                        disabled={!editable}
                        onValueChange={(v) => updateProfile(p.id, { document_permission: v as DocumentPermission })}
                      >
                        <SelectTrigger className="w-48">
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
                    </TableCell>

                    <TableCell>
                      <Switch
                        checked={p.can_comment}
                        disabled={!editable}
                        onCheckedChange={(checked) => updateProfile(p.id, { can_comment: checked })}
                      />
                    </TableCell>

                    <TableCell>
                      <Select
                        value={p.case_visibility_scope}
                        disabled={!editable}
                        onValueChange={(v) => updateProfile(p.id, { case_visibility_scope: v as VisibilityScope })}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(VISIBILITY_SCOPE_LABELS).map(([value, label]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              disabled={!isAdmin && (value === "specific_departments" || value === "organization")}
                            >
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
