import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Client } from "@/lib/database.types";
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

interface ClientFormDialogProps {
  client?: Client;
  trigger: React.ReactNode;
  onSaved: () => void;
}

export function ClientFormDialog({ client, trigger, onSaved }: ClientFormDialogProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [clientType, setClientType] = useState(client?.client_type ?? "persona_fisica");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.organization_id) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);

    const payload = {
      organization_id: profile.organization_id,
      client_type: clientType,
      full_name: String(form.get("full_name")),
      rfc: String(form.get("rfc") || "") || null,
      curp: String(form.get("curp") || "") || null,
      address: String(form.get("address") || "") || null,
      phone: String(form.get("phone") || "") || null,
      email: String(form.get("email") || "") || null,
      notes: String(form.get("notes") || "") || null,
    };

    const { error } = client
      ? await supabase.from("clients").update(payload).eq("id", client.id)
      : await supabase.from("clients").insert({ ...payload, created_by: profile.id });

    setSubmitting(false);
    if (error) {
      toast.error("No se pudo guardar el cliente", { description: error.message });
      return;
    }
    toast.success(client ? "Cliente actualizado" : "Cliente creado");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            <DialogDescription>Persona física o moral asociada a uno o más expedientes.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={clientType} onValueChange={(v) => setClientType(v as typeof clientType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="persona_fisica">Persona física</SelectItem>
                  <SelectItem value="persona_moral">Persona moral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">{clientType === "persona_moral" ? "Razón social" : "Nombre completo"}</Label>
              <Input id="full_name" name="full_name" defaultValue={client?.full_name} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rfc">RFC</Label>
                <Input id="rfc" name="rfc" defaultValue={client?.rfc ?? ""} />
              </div>
              {clientType === "persona_fisica" && (
                <div className="space-y-2">
                  <Label htmlFor="curp">CURP</Label>
                  <Input id="curp" name="curp" defaultValue={client?.curp ?? ""} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Domicilio</Label>
              <Input id="address" name="address" defaultValue={client?.address ?? ""} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
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
