import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useActTypes } from "@/hooks/useLookups";
import type { ActType, Case } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseFormDialog } from "@/components/cases/CaseFormDialog";
import { CASE_STATUS_BADGE, CASE_STATUS_LABELS } from "@/lib/constants";
import type { CaseStatus } from "@/lib/database.types";

type CaseWithActType = Case & { act_type: ActType | null };

export function CasesListPage() {
  const [cases, setCases] = useState<CaseWithActType[]>([]);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [actTypeFilter, setActTypeFilter] = useState<string>("all");
  const actTypes = useActTypes();

  async function load() {
    const { data, error } = await supabase
      .from("cases")
      .select("*, act_type:act_types(*)")
      .order("created_at", { ascending: false });
    if (!error) setCases((data as CaseWithActType[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = cases.filter(
    (c) => (statusFilter === "all" || c.status === statusFilter) && (actTypeFilter === "all" || c.act_type_id === actTypeFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expedientes</h1>
          <p className="text-muted-foreground">Actos notariales en trámite.</p>
        </div>
        <CaseFormDialog
          onSaved={load}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo expediente
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CaseStatus | "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actTypeFilter} onValueChange={setActTypeFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Tipo de acto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos de acto</SelectItem>
            {actTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expediente</TableHead>
              <TableHead>Tipo de acto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha límite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin expedientes que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link to={`/expedientes/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.act_type?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={CASE_STATUS_BADGE[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.due_date ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
