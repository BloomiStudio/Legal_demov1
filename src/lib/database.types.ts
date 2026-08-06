// Tipos escritos a mano que reflejan supabase/migrations/. Cuando el
// proyecto esté conectado a un Supabase real, se pueden regenerar con
// `supabase gen types typescript --linked > src/lib/database.types.ts`.

export type AppRole = "administrador" | "notario" | "abogado" | "asistente";
export type CaseStatus = "open" | "in_progress" | "closed" | "cancelled";
export type DocumentReviewStatus = "ai_draft" | "in_review" | "approved" | "rejected";
export type AiApprovalStatus = "pending" | "approved" | "rejected";
export type TranscriptionStatus = "pending" | "processing" | "completed" | "failed";
export type AlertStatus = "pending" | "sent" | "dismissed" | "resolved";
export type DocumentPermission = "read" | "comment" | "create" | "edit";
export type VisibilityScope = "own" | "department" | "specific_departments" | "organization";
export type RequirementStatus = "suggested" | "approved" | "rejected";
export type RequirementSource = "ai" | "admin";
export type CaseRequirementFulfillment = "pending" | "fulfilled";

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string | null;
  department_id: string | null;
  full_name: string;
  role: AppRole;
  is_department_admin: boolean;
  document_permission: DocumentPermission;
  can_comment: boolean;
  case_visibility_scope: VisibilityScope;
  created_at: string;
  updated_at: string;
}

export interface ProfileVisibleDepartment {
  profile_id: string;
  department_id: string;
}

export interface Client {
  id: string;
  organization_id: string;
  client_type: "persona_fisica" | "persona_moral";
  full_name: string;
  rfc: string | null;
  curp: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActType {
  id: string;
  code: string;
  name: string;
  module: string;
  is_active: boolean;
  created_at: string;
}

export interface Template {
  id: string;
  organization_id: string;
  act_type_id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  organization_id: string;
  department_id: string;
  act_type_id: string;
  status: CaseStatus;
  title: string;
  responsible_user_id: string | null;
  opened_at: string;
  due_date: string | null;
  notes: string | null;
  notify_client_on_missing_docs: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseClient {
  id: string;
  case_id: string;
  client_id: string;
  role_in_case: string;
}

export interface CaseParty {
  id: string;
  case_id: string;
  full_name: string;
  party_role: string;
  rfc: string | null;
  curp: string | null;
  identification_notes: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  case_id: string;
  document_type: string;
  version: number;
  review_status: DocumentReviewStatus;
  storage_path: string;
  storage_path_pdf: string | null;
  generated_by_ai: boolean;
  requirement_id: string | null;
  uploaded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExample {
  id: string;
  template_id: string;
  storage_path: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DocumentRequirement {
  id: string;
  organization_id: string;
  act_type_id: string;
  label: string;
  description: string | null;
  is_required: boolean;
  status: RequirementStatus;
  source: RequirementSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseRequirementStatus {
  id: string;
  case_id: string;
  requirement_id: string;
  status: CaseRequirementFulfillment;
  fulfilled_document_id: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  recipient_user_id: string;
  case_id: string | null;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AiGeneration {
  id: string;
  case_id: string;
  document_id: string | null;
  template_id: string | null;
  input_data: Record<string, unknown>;
  prompt_used: string | null;
  output: string | null;
  approval_status: AiApprovalStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface Transcription {
  id: string;
  case_id: string | null;
  document_id: string | null;
  source_storage_path: string;
  status: TranscriptionStatus;
  extracted_text: { page: number; text: string }[] | null;
  error_message: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  case_id: string;
  alert_type: string;
  due_date: string;
  status: AlertStatus;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CaseComment {
  id: string;
  case_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
