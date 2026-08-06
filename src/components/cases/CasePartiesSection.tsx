import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { CaseClient, CaseParty, Client } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CASE_CLIENT_ROLE_SUGGESTIONS, PARTY_ROLE_SUGGESTIONS } from "@/lib/constants";

export function CasePartiesSection({ caseId }: { caseId: string }) {
  const [caseClients, setCaseClients] = useState<(CaseClient & { client: Client })[]>([]);
  const [caseParties, setCaseParties] = useState<CaseParty[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);

  async function load() {
    const [ccRes, cpRes, clientsRes] = await Promise.all([
      supabase.from("case_clients").select("*, client:clients(*)").eq("case_id", caseId),
      supabase.from("case_parties").select("*").eq("case_id", caseId).order("created_at"),
      supabase.from("clients").select("*").order("full_name"),
    ]);
    setCaseClients((ccRes.data as (CaseClient & { client: Client })[]) ?? []);
    setCaseParties((cpRes.data as CaseParty[]) ?? []);
    setAllClients((clientsRes.data as Client[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [caseId]);

  async function addClientRole(event: FormEvent<HTMLFormElement>, clientId: string, roleInCase: string) {
    event.preventDefault();
    const { error } = await supabase.from("case_clients").insert({ case_id: caseId, client_id: clientId, role_in_case: roleInCase });
    if (error) return toast.error("No se pudo agregar", { description: error.message });
    load();
  }

  async function removeClientRole(id: string) {
    const { error } = await supabase.from("case_clients").delete().eq("id", id);
    if (error) return toast.error("No se pudo quitar", { description: error.message });
    load();
  }

  async function addParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("case_parties").insert({
      case_id: caseId,
      full_name: String(form.get("full_name")),
      party_role: String(form.get("party_role")),
      rfc: String(form.get("rfc") || "") || null,
      curp: String(form.get("curp") || "") || null,
      identification_notes: String(form.get("identification_notes") || "") || null,
    });
    if (error) return toast.error("No se pudo agregar compareciente", { description: error.message });
    load();
  }

  async function removeParty(id: string) {
    const { error } = await supabase.from("case_parties").delete().eq("id", id);
    if (error) return toast.error("No se pudo quitar", { description: error.message });
    load();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Clientes en el expediente</CardTitle>
          <AddClientDialog clients={allClients} onAdd={addClientRole} />
        </CardHeader>
        <CardContent className="space-y-2">
          {caseClients.length === 0 && <p className="text-sm text-muted-foreground">Sin clientes asociados.</p>}
          {caseClients.map((cc) => (
            <div key={cc.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <p className="font-medium">{cc.client?.full_name}</p>
                <Badge variant="outline" className="mt-1">
                  {cc.role_in_case}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeClientRole(cc.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparecientes (testigos, apoderados…)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={addParty} className="grid grid-cols-2 gap-2 rounded-md border p-3">
            <Input name="full_name" placeholder="Nombre completo" required className="col-span-2" />
            <Input name="party_role" placeholder="Rol (ej. testigo)" list="party-role-suggestions" required />
            <datalist id="party-role-suggestions">
              {PARTY_ROLE_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <Input name="rfc" placeholder="RFC (opcional)" />
            <Input name="curp" placeholder="CURP (opcional)" className="col-span-2" />
            <Button type="submit" size="sm" className="col-span-2">
              <Plus className="mr-1 h-3 w-3" /> Agregar compareciente
            </Button>
          </form>

          {caseParties.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <p className="font-medium">{p.full_name}</p>
                <Badge variant="outline" className="mt-1">
                  {p.party_role}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeParty(p.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AddClientDialog({
  clients,
  onAdd,
}: {
  clients: Client[];
  onAdd: (e: FormEvent<HTMLFormElement>, clientId: string, role: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [role, setRole] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-3 w-3" /> Agregar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            if (!clientId || !role) {
              e.preventDefault();
              toast.error("Selecciona un cliente y un rol");
              return;
            }
            onAdd(e, clientId, role);
            setOpen(false);
            setClientId("");
            setRole("");
          }}
        >
          <DialogHeader>
            <DialogTitle>Agregar cliente al expediente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rol en el expediente</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} list="case-client-role-suggestions" placeholder="Ej. vendedor" />
              <datalist id="case-client-role-suggestions">
                {CASE_CLIENT_ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Agregar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
