import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PermissionLevel = "sem_acesso" | "ver" | "editar";

export const ADMIN_RESOURCES = [
  "dashboard",
  "pedidos",
  "financeiro",
  "estoque",
  "produtos",
  "familias",
  "fabricantes",
  "fornecedores",
  "clientes",
  "locais_estoque",
  "bancos",
  "formas_pagamento",
  "usuarios",
  "configuracoes",
  "receitas",
  "producao",
] as const;

export type AdminResource = (typeof ADMIN_RESOURCES)[number];

export const RESOURCE_LABELS: Record<AdminResource, string> = {
  dashboard: "Dashboard",
  pedidos: "Pedidos",
  financeiro: "Financeiro",
  estoque: "Estoque",
  produtos: "Produtos",
  familias: "Famílias",
  fabricantes: "Fabricantes",
  fornecedores: "Fornecedores",
  clientes: "Clientes",
  locais_estoque: "Locais Estoque",
  bancos: "Bancos",
  formas_pagamento: "Formas Pagamento",
  usuarios: "Usuários",
  configuracoes: "Configurações",
};

/** Maps route paths to resource keys */
export const ROUTE_TO_RESOURCE: Record<string, AdminResource> = {
  "/admin": "dashboard",
  "/admin/pedidos": "pedidos",
  "/admin/financeiro": "financeiro",
  "/admin/estoque": "estoque",
  "/admin/produtos": "produtos",
  "/admin/familias": "familias",
  "/admin/fabricantes": "fabricantes",
  "/admin/fornecedores": "fornecedores",
  "/admin/clientes": "clientes",
  "/admin/locais-estoque": "locais_estoque",
  "/admin/bancos": "bancos",
  "/admin/formas-pagamento": "formas_pagamento",
  "/admin/usuarios": "usuarios",
  "/admin/configuracoes": "configuracoes",
};

interface PermissionsContextType {
  permissions: Record<string, PermissionLevel>;
  loading: boolean;
  can: (resource: AdminResource, level?: PermissionLevel) => boolean;
  reload: () => void;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: {},
  loading: true,
  can: () => false,
  reload: () => {},
});

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    setIsAdmin(!!adminCheck);

    // Load explicit permissions
    const { data } = await supabase
      .from("user_permissions")
      .select("recurso, nivel")
      .eq("user_id", user.id);

    const map: Record<string, PermissionLevel> = {};
    if (data) {
      data.forEach((p: any) => {
        map[p.recurso] = p.nivel as PermissionLevel;
      });
    }

    // For admin users, default to "editar" for unset resources
    if (adminCheck) {
      ADMIN_RESOURCES.forEach((r) => {
        if (!map[r]) map[r] = "editar";
      });
    }

    setPermissions(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (resource: AdminResource, level: PermissionLevel = "ver") => {
      const userLevel = permissions[resource] || "sem_acesso";
      if (level === "ver") return userLevel === "ver" || userLevel === "editar";
      if (level === "editar") return userLevel === "editar";
      return false;
    },
    [permissions]
  );

  const value = useMemo(
    () => ({ permissions, loading, can, reload: load }),
    [permissions, loading, can, load]
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionsContext);
