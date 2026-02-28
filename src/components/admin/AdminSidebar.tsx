import {
  LayoutDashboard, Package, Layers, Factory, Users, ShoppingCart,
  DollarSign, Settings, LogOut, Truck, Warehouse, Boxes, Landmark, CreditCard,
  ChevronDown, FolderOpen,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

const cadastroItems = [
  { title: "Produtos", url: "/admin/produtos", icon: Package },
  { title: "Famílias", url: "/admin/familias", icon: Layers },
  { title: "Fabricantes", url: "/admin/fabricantes", icon: Factory },
  { title: "Fornecedores", url: "/admin/fornecedores", icon: Truck },
  { title: "Clientes", url: "/admin/clientes", icon: Users },
  { title: "Locais Estoque", url: "/admin/locais-estoque", icon: Warehouse },
  { title: "Estoque", url: "/admin/estoque", icon: Boxes },
  { title: "Bancos", url: "/admin/bancos", icon: Landmark },
  { title: "Formas Pgto", url: "/admin/formas-pagamento", icon: CreditCard },
];

const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const isActive = (url: string) =>
    url === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(url);

  const cadastroActive = cadastroItems.some((i) => isActive(i.url));
  const [cadastroOpen, setCadastroOpen] = useState(cadastroActive);

  const menuLink = (item: { title: string; url: string; icon: any }, end = false) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={end}
          className="hover:bg-sidebar-accent/60"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <item.icon className="mr-2 h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-3 pt-3">
              Admin
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuLink({ title: "Dashboard", url: "/admin", icon: LayoutDashboard }, true)}
              {menuLink({ title: "Pedidos", url: "/admin/pedidos", icon: ShoppingCart })}
              {menuLink({ title: "Financeiro", url: "/admin/financeiro", icon: DollarSign })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Cadastro group */}
        <SidebarGroup>
          {collapsed ? (
            <SidebarGroupContent>
              <SidebarMenu>
                {cadastroItems.map((item) => menuLink(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          ) : (
            <Collapsible open={cadastroOpen} onOpenChange={setCadastroOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-md transition-colors">
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Cadastros</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${cadastroOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="pl-2">
                    {cadastroItems.map((item) => menuLink(item))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          )}
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuLink({ title: "Configurações", url: "/admin/configuracoes", icon: Settings })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
          onClick={async () => { await signOut(); navigate("/"); }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
