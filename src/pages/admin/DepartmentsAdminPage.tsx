import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useDepartments } from "@/hooks/useLookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DepartmentsAdminPage() {
  const { profile, isAdmin } = useAuth();
  const { departments, refetch } = useDepartments();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.organization_id || !name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("departments").insert({ organization_id: profile.organization_id, name: name.trim() });
    setSubmitting(false);
    if (error) return toast.error("No se pudo crear el departamento", { description: error.message });
    setName("");
    toast.success("Departamento creado");
    refetch();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Departamentos</h1>
        <p className="text-muted-foreground">
          {isAdmin
            ? "Crea los departamentos de tu organización. La administración de permisos de cada persona se hace en Usuarios."
            : "Solo un administrador general puede crear o renombrar departamentos."}
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo departamento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Corporativo" />
              <Button type="submit" disabled={submitting || !name.trim()}>
                <Plus className="mr-2 h-4 w-4" /> Crear
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
