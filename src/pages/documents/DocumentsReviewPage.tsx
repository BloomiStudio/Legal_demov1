import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download, FileType, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Case, Document } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOCUMENT_REVIEW_LABELS } from "@/lib/constants";

type DocumentWithCase = Document & { case: Case | null };

export function DocumentsReviewPage() {
  const { canApproveDocuments } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithCase[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*, case:cases(*)")
      .order("created_at", { ascending: false });
    if (!error) setDocuments((data as DocumentWithCase[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleReview(documentId: string, decision: "approved" | "rejected") {
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke("approve-document", {
      body: { document_id: documentId, decision },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    });
    if (error) return toast.error("No se pudo procesar la revisión", { description: error.message });
    toast.success(decision === "approved" ? "Documento aprobado" : "Documento rechazado");
    load();
  }

  async function downloadFile(path: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) return toast.error("No se pudo generar el enlace de descarga");
    window.open(data.signedUrl, "_blank");
  }

  const pending = documents.filter((d) => d.review_status === "ai_draft");
  const rest = documents.filter((d) => d.review_status !== "ai_draft");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
        <p className="text-muted-foreground">Borradores generados por IA pendientes de revisión humana, e historial.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expediente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No hay borradores pendientes de revisión.
                  </TableCell>
                </TableRow>
              )}
              {pending.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Link to={`/expedientes/${doc.case_id}`} className="hover:underline">
                      {doc.case?.title ?? doc.case_id}
                    </Link>
                  </TableCell>
                  <TableCell>{doc.document_type}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{DOCUMENT_REVIEW_LABELS[doc.review_status]}</Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => downloadFile(doc.storage_path)} title="Descargar (Word)">
                      <Download className="h-4 w-4" />
                    </Button>
                    {doc.storage_path_pdf && (
                      <Button variant="ghost" size="icon" onClick={() => downloadFile(doc.storage_path_pdf!)} title="Descargar (PDF)">
                        <FileType className="h-4 w-4" />
                      </Button>
                    )}
                    {canApproveDocuments && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleReview(doc.id, "approved")} title="Aprobar">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleReview(doc.id, "rejected")} title="Rechazar">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Historial</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rest.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Link to={`/expedientes/${doc.case_id}`} className="hover:underline">
                        {doc.case?.title ?? doc.case_id}
                      </Link>
                    </TableCell>
                    <TableCell>{doc.document_type}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{DOCUMENT_REVIEW_LABELS[doc.review_status]}</Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => downloadFile(doc.storage_path)} title="Descargar (Word)">
                        <Download className="h-4 w-4" />
                      </Button>
                      {doc.storage_path_pdf && (
                        <Button variant="ghost" size="icon" onClick={() => downloadFile(doc.storage_path_pdf!)} title="Descargar (PDF)">
                          <FileType className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
