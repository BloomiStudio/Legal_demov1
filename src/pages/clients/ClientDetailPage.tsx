import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Case, CaseClient, Client } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { CASE_STATUS_BADGE, CASE_STATUS_LABELS } from "@/lib/constants";

export function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<(CaseClient & { case: Case })[]>([]);

  async function load() {
    if (!clientId) return;
    const { data: clientData } = await supabase.from("clients").select("*").eq("id", clientId).single();
    setClient(clientData as Client);

    const { data: caseLinks } = await supabase
      .from("case_clients")
      .select("*, case:cases(*)")
      .eq("client_id", clientId);
    setCases((caseLinks as (CaseClient & { case: Case })[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [clientId]);

  if (!client) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.full_name}</h1>
            <p className="text-muted-foreground">
              {client.client_type === "persona_moral" ? "Persona moral" : "Persona física"}
            </p>
          </div>
        </div>
        <ClientFormDialog
          client={client}
          onSaved={load}
          trigger={
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">RFC:</span> {client.rfc ?? "—"}
            </p>
            {client.client_type === "persona_fisica" && (
              <p>
                <span className="text-muted-foreground">CURP:</span> {client.curp ?? "—"}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Teléfono:</span> {client.phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Correo:</span> {client.email ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Domicilio:</span> {client.address ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{client.notes || "Sin notas."}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expedientes relacionados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cases.length === 0 && <p className="text-sm text-muted-foreground">Sin expedientes todavía.</p>}
          {cases.map((link) => (
            <Link
              key={link.id}
              to={`/expedientes/${link.case_id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{link.case?.title}</p>
                <p className="text-muted-foreground">Rol: {link.role_in_case}</p>
              </div>
              {link.case && (
                <Badge variant={CASE_STATUS_BADGE[link.case.status]}>{CASE_STATUS_LABELS[link.case.status]}</Badge>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
