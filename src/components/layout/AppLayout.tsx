import { NavLink, Outlet } from "react-router-dom";
import {
  FileText,
  Files,
  Gavel,
  LayoutDashboard,
  Bell,
  ScanText,
  ShieldCheck,
  Users,
  LogOut,
  Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true },
  { to: "/expedientes", label: "Expedientes", icon: Gavel },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/documentos", label: "Documentos", icon: Files },
  { to: "/transcripciones", label: "Transcripciones", icon: ScanText },
  { to: "/alertas", label: "Alertas", icon: Bell },
];

const ADMIN_NAV_ITEMS = [
  { to: "/admin/usuarios", label: "Usuarios y permisos", icon: ShieldCheck },
  { to: "/admin/departamentos", label: "Departamentos", icon: Building2 },
  { to: "/admin/plantillas", label: "Plantillas y requisitos", icon: FileText },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppLayout() {
  const { profile, isAdmin, isDepartmentAdmin, signOut } = useAuth();
  const canSeeAdminNav = isAdmin || isDepartmentAdmin;

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-semibold">Plataforma Notarial</span>
          </div>
          <NotificationsBell />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}

          {canSeeAdminNav && (
            <>
              <div className="my-3 px-3 text-xs font-semibold uppercase text-muted-foreground">
                Administración
              </div>
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{profile ? initials(profile.full_name) : "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {profile ? ROLE_LABELS[profile.role] : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
