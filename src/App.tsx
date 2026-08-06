import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ClientsListPage } from "@/pages/clients/ClientsListPage";
import { ClientDetailPage } from "@/pages/clients/ClientDetailPage";
import { CasesListPage } from "@/pages/cases/CasesListPage";
import { CaseDetailPage } from "@/pages/cases/CaseDetailPage";
import { DocumentsReviewPage } from "@/pages/documents/DocumentsReviewPage";
import { TranscriptionsPage } from "@/pages/transcriptions/TranscriptionsPage";
import { AlertsPage } from "@/pages/alerts/AlertsPage";
import { UsersAdminPage } from "@/pages/admin/UsersAdminPage";
import { DepartmentsAdminPage } from "@/pages/admin/DepartmentsAdminPage";
import { TemplatesAdminPage } from "@/pages/admin/TemplatesAdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clientes" element={<ClientsListPage />} />
              <Route path="/clientes/:clientId" element={<ClientDetailPage />} />
              <Route path="/expedientes" element={<CasesListPage />} />
              <Route path="/expedientes/:caseId" element={<CaseDetailPage />} />
              <Route path="/documentos" element={<DocumentsReviewPage />} />
              <Route path="/transcripciones" element={<TranscriptionsPage />} />
              <Route path="/alertas" element={<AlertsPage />} />

              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="/admin/usuarios" element={<UsersAdminPage />} />
                <Route path="/admin/departamentos" element={<DepartmentsAdminPage />} />
                <Route path="/admin/plantillas" element={<TemplatesAdminPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}
