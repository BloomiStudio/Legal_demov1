import type {
  AiApprovalStatus,
  AlertStatus,
  AppRole,
  CaseStatus,
  DocumentPermission,
  DocumentReviewStatus,
  TranscriptionStatus,
  VisibilityScope,
} from "@/lib/database.types";

export const ROLE_LABELS: Record<AppRole, string> = {
  administrador: "Administrador",
  notario: "Notario / Socio",
  abogado: "Abogado / Fedatario",
  asistente: "Asistente",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

export const CASE_STATUS_BADGE: Record<CaseStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  in_progress: "secondary",
  closed: "outline",
  cancelled: "destructive",
};

export const DOCUMENT_REVIEW_LABELS: Record<DocumentReviewStatus, string> = {
  ai_draft: "Borrador IA",
  in_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const AI_APPROVAL_LABELS: Record<AiApprovalStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const TRANSCRIPTION_STATUS_LABELS: Record<TranscriptionStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completada",
  failed: "Falló",
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  pending: "Pendiente",
  sent: "Enviada",
  dismissed: "Descartada",
  resolved: "Resuelta",
};

export const DOCUMENT_PERMISSION_LABELS: Record<DocumentPermission, string> = {
  read: "Solo lectura",
  comment: "Comentarios",
  create: "Creación de documentos",
  edit: "Edición de documentos",
};

export const VISIBILITY_SCOPE_LABELS: Record<VisibilityScope, string> = {
  own: "Solo sus propios expedientes",
  department: "Todo su departamento",
  specific_departments: "Departamentos específicos",
  organization: "Toda la organización",
};

export const PARTY_ROLE_SUGGESTIONS = ["testigo", "apoderado", "representante_legal", "traductor", "perito"];

export const CASE_CLIENT_ROLE_SUGGESTIONS = ["vendedor", "comprador", "otorgante", "donante", "donatario", "acreedor", "deudor"];
