import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";

export function ClientsListPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("full_name");
    if (!error) setClients((data as Client[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = clients.filter((c) =>
    [c.full_name, c.rfc, c.email].filter(Boolean).some((v) => v!.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Personas físicas y morales de la notaría.</p>
        </div>
        <ClientFormDialog
          onSaved={load}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
            </Button>
          }
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, RFC o correo…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre / Razón social</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>RFC</TableHead>
              <TableHead>Contacto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin clientes.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link to={`/clientes/${client.id}`} className="font-medium hover:underline">
                    {client.full_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {client.client_type === "persona_moral" ? "Persona moral" : "Persona física"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{client.rfc ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{client.email ?? client.phone ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
