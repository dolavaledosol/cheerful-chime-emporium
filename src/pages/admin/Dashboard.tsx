import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, DollarSign, Package, Users, TrendingDown, TrendingUp } from "lucide-react";

const StatCard = ({ title, value, icon: Icon, description }: {
  title: string; value: string; icon: any; description?: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    pedidosHoje: 0,
    faturamento: 0,
    totalProdutos: 0,
    totalClientes: 0,
    totalPagar: 0,
    qtdPagar: 0,
    totalReceber: 0,
    qtdReceber: 0,
  });

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [pedidos, produtos, clientes, pagar, receber] = await Promise.all([
        supabase.from("pedido").select("total, status").gte("data", today),
        supabase.from("produto").select("produto_id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("cliente").select("cliente_id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("contas_pagar").select("valor").eq("pago", false),
        supabase.from("contas_receber").select("valor").eq("recebido", false),
      ]);

      const pedidosData = pedidos.data || [];
      const faturamento = pedidosData
        .filter((p: any) => p.status !== "cancelado" && p.status !== "carrinho")
        .reduce((sum: number, p: any) => sum + Number(p.total), 0);

      const pagarData = pagar.data || [];
      const receberData = receber.data || [];

      setStats({
        pedidosHoje: pedidosData.filter((p: any) => p.status !== "carrinho").length,
        faturamento,
        totalProdutos: produtos.count || 0,
        totalClientes: clientes.count || 0,
        totalPagar: pagarData.reduce((s: number, r: any) => s + Number(r.valor), 0),
        qtdPagar: pagarData.length,
        totalReceber: receberData.reduce((s: number, r: any) => s + Number(r.valor), 0),
        qtdReceber: receberData.length,
      });
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pedidos hoje" value={String(stats.pedidosHoje)} icon={ShoppingCart} />
        <StatCard
          title="Faturamento hoje"
          value={`R$ ${stats.faturamento.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatCard title="Produtos ativos" value={String(stats.totalProdutos)} icon={Package} />
        <StatCard title="Clientes" value={String(stats.totalClientes)} icon={Users} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Contas a Pagar pendentes</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ {stats.totalPagar.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.qtdPagar} conta(s) em aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Contas a Receber pendentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {stats.totalReceber.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.qtdReceber} conta(s) em aberto</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhum pedido registrado ainda.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Origem dos pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Web • WhatsApp • Vendedor</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
