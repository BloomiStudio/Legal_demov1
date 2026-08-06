import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Alert, Case } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ALERT_STATUS_LABELS } from "@/lib/constants";

type AlertWithCase = Alert & { case: Case | null };

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertWithCase[]>([]);

  async function load() {
    const { data, error } = await supabase
      .from("alerts")
      .select("*, case:cases(*)")
      .order("due_date", { ascending: true });
    if (!error) setAlerts((data as AlertWithCase[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function dismiss(id: string) {
    const { error } = await supabase.from("alerts").update({ status: "dismissed" }).eq("id", id);
    if (error) return toast.error("No se pudo descartar la alerta", { description: error.message });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas de vencimiento</h1>
        <p className="text-muted-foreground">Expedientes que se acercan a su fecha límite.</p>
      </div>

      <div className="space-y-2">
        {alerts.length === 0 && <p className="text-sm text-muted-foreground">No hay alertas.</p>}
        {alerts.map((alert) => (
          <Card key={alert.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <Link to={`/expedientes/${alert.case_id}`} className="font-medium hover:underline">
                  {alert.case?.title ?? alert.case_id}
                </Link>
                <p className="text-sm text-muted-foreground">{alert.message ?? alert.alert_type}</p>
                <p className="text-xs text-muted-foreground">Vence: {alert.due_date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={alert.status === "pending" ? "secondary" : "outline"}>
                  {ALERT_STATUS_LABELS[alert.status]}
                </Badge>
                {alert.status === "pending" && (
                  <Button variant="ghost" size="icon" onClick={() => dismiss(alert.id)} title="Descartar">
                    <BellOff className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
