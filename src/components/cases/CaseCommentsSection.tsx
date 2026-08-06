import { useEffect, useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { CaseComment, Profile } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CaseCommentsSection({ caseId }: { caseId: string }) {
  const { profile, isAdmin, isDepartmentAdmin } = useAuth();
  const [comments, setComments] = useState<(CaseComment & { author: Profile | null })[]>([]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canComment = isAdmin || isDepartmentAdmin || profile?.can_comment;

  async function load() {
    const { data } = await supabase
      .from("case_comments")
      .select("*, author:profiles(*)")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    setComments((data as (CaseComment & { author: Profile | null })[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [caseId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !body.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("case_comments").insert({ case_id: caseId, author_id: profile.id, body: body.trim() });
    setSubmitting(false);
    if (error) return toast.error("No se pudo publicar el comentario", { description: error.message });
    setBody("");
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comentarios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Sin comentarios todavía.</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {c.author?.full_name
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 rounded-md border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{c.author?.full_name ?? "Usuario"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{c.body}</p>
            </div>
          </div>
        ))}

        {canComment ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe un comentario para el equipo…"
              rows={3}
            />
            <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
              Comentar
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">No tienes permiso de comentarios en este expediente.</p>
        )}
      </CardContent>
    </Card>
  );
}
