import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, ROUTE_TO_RESOURCE } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert } from "lucide-react";

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permLoading } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }

    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) { navigate("/", { replace: true }); return; }
      setIsAdmin(true);
    };
    checkAdmin();
  }, [user, authLoading, navigate]);

  if (authLoading || isAdmin === null || permLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // Check permission for current route
  const resource = ROUTE_TO_RESOURCE[location.pathname];
  const hasAccess = resource ? can(resource, "ver") : true;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-2 border-b px-3 bg-background sticky top-0 z-30">
            <SidebarTrigger />
            <Link to="/admin" className="flex items-center shrink-0">
              <img src="/images/logo-cozinha-dodola.png" alt="CozinhaDoDola" className="h-8 w-auto" />
            </Link>
            <span className="text-sm font-semibold text-muted-foreground">Painel Admin</span>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {hasAccess ? children : (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
                <ShieldAlert className="h-12 w-12" />
                <p className="text-lg font-medium">Acesso negado</p>
                <p className="text-sm">Você não tem permissão para acessar este recurso.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
