import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import Perfil from "./pages/Perfil";
import AdminLayout from "@/components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Produtos from "./pages/admin/Produtos";
import Familias from "./pages/admin/Familias";
import Fabricantes from "./pages/admin/Fabricantes";
import Clientes from "./pages/admin/Clientes";
import Pedidos from "./pages/admin/Pedidos";
import Fornecedores from "./pages/admin/Fornecedores";
import LocaisEstoque from "./pages/admin/LocaisEstoque";
import Estoque from "./pages/admin/Estoque";
import Bancos from "./pages/admin/Bancos";
import FormasPagamento from "./pages/admin/FormasPagamento";
import Financeiro from "./pages/admin/Financeiro";
import Configuracoes from "./pages/admin/Configuracoes";
import Usuarios from "./pages/admin/Usuarios";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />

              {/* Admin routes */}
              <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
              <Route path="/admin/produtos" element={<AdminLayout><Produtos /></AdminLayout>} />
              <Route path="/admin/familias" element={<AdminLayout><Familias /></AdminLayout>} />
              <Route path="/admin/fabricantes" element={<AdminLayout><Fabricantes /></AdminLayout>} />
              <Route path="/admin/clientes" element={<AdminLayout><Clientes /></AdminLayout>} />

              <Route path="/admin/pedidos" element={<AdminLayout><Pedidos /></AdminLayout>} />
              <Route path="/admin/fornecedores" element={<AdminLayout><Fornecedores /></AdminLayout>} />
              <Route path="/admin/locais-estoque" element={<AdminLayout><LocaisEstoque /></AdminLayout>} />
              <Route path="/admin/estoque" element={<AdminLayout><Estoque /></AdminLayout>} />
              <Route path="/admin/bancos" element={<AdminLayout><Bancos /></AdminLayout>} />
              <Route path="/admin/formas-pagamento" element={<AdminLayout><FormasPagamento /></AdminLayout>} />
              <Route path="/admin/financeiro" element={<AdminLayout><Financeiro /></AdminLayout>} />
              <Route path="/admin/configuracoes" element={<AdminLayout><Configuracoes /></AdminLayout>} />
              <Route path="/admin/usuarios" element={<AdminLayout><Usuarios /></AdminLayout>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
