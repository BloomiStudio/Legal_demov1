import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, FileClock, Gavel, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CASE_STATUS_BADGE, CASE_STATUS_LABELS } from "@/lib/constants";
import type { Alert, Case } from "@/lib/database.types";

interface Summary {
  openCases: number;
  totalClients: number;
  pendingDocuments: number;
  pendingAlerts: number;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    async function load() {
      const [openCases, totalClients, pendingDocuments, pendingAlerts, recent, alertRows] = await Promise.all([
        supabase.from("cases").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("review_status", "ai_draft"),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("cases").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("alerts").select("*").eq("status", "pending").order("due_date", { ascending: true }).limit(5),
      ]);

      setSummary({
        openCases: openCases.count ?? 0,
        totalClients: totalClients.count ?? 0,
        pendingDocuments: pendingDocuments.count ?? 0,
        pendingAlerts: pendingAlerts.count ?? 0,
      });
      setRecentCases((recent.data as Case[]) ?? []);
      setAlerts((alertRows.data as Alert[]) ?? []);
    }
    load();
  }, []);

  const cards = [
    { label: "Expedientes abiertos", value: summary?.openCases, icon: Gavel, to: "/expedientes" },
    { label: "Clientes registrados", value: summary?.totalClients, icon: Users, to: "/clientes" },
    { label: "Documentos por revisar", value: summary?.pendingDocuments, icon: FileClock, to: "/documentos" },
    { label: "Alertas pendientes", value: summary?.pendingAlerts, icon: Bell, to: "/alertas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {profile?.full_name?.split(" ")[0] ?? ""}
        </h1>
        <p className="text-muted-foreground">Este es el resumen de tu notaría hoy.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  {summary ? (
                    <p className="text-3xl font-semibold">{card.value}</p>
                  ) : (
                    <Skeleton className="mt-1 h-8 w-10" />
                  )}
                </div>
                <card.icon className="h-8 w-8 text-primary/60" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expedientes recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCases.length === 0 && <p className="text-sm text-muted-foreground">Sin expedientes todavía.</p>}
            {recentCases.map((c) => (
              <Link
                key={c.id}
                to={`/expedientes/${c.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <span className="truncate font-medium">{c.title}</span>
                <Badge variant={CASE_STATUS_BADGE[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos vencimientos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No hay alertas pendientes.</p>}
            {alerts.map((a) => (
              <Link
                key={a.id}
                to={`/expedientes/${a.case_id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <span className="truncate">{a.message ?? a.alert_type}</span>
                <span className="text-muted-foreground">{a.due_date}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
