import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingCart, DollarSign, TrendingDown, TrendingUp,
  CalendarDays, BarChart3, ClipboardList, Globe, MessageCircle, Monitor,
  ChevronRight, CalendarMinus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import PullToRefresh from "@/components/shared/PullToRefresh";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type OrigemFat = {
  origem: string;
  totalHoje: number;
  qtdHoje: number;
  totalMes: number;
  qtdMes: number;
  totalAcumulado: number;
  qtdAcumulado: number;
};
type StatusResumo = { status: string; qtd: number; total: number };

const STATUS_LABELS: Record<string, string> = {
  separacao: "Separação",
  aguardando_pagamento: "Aguard. Pgto",
  pago: "Pago",
};

const STATUS_COLORS: Record<string, string> = {
  separacao: "bg-warning/15 text-warning border-warning/30",
  aguardando_pagamento: "bg-primary/10 text-primary border-primary/30",
  pago: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
};

const ORIGEM_ICONS: Record<string, any> = {
  web: Globe,
  whatsapp: MessageCircle,
  admin: Monitor,
};

const ORIGEM_LABELS: Record<string, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  admin: "Admin",
};

const Dashboard = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pedidosHoje: 0, faturamento: 0,
    pedidosMes: 0, faturamentoMes: 0,
    pedidosMesAnt: 0, faturamentoMesAnt: 0,
    totalPagar: 0, qtdPagar: 0,
    totalReceber: 0, qtdReceber: 0,
  });
  const [origemFat, setOrigemFat] = useState<OrigemFat[]>([]);
  const [statusResumo, setStatusResumo] = useState<StatusResumo[]>([]);

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartISO = monthStart.toISOString();

    const prevMonthEnd = new Date(monthStart);
    prevMonthEnd.setMilliseconds(-1);
    const prevMonthStart = new Date(prevMonthEnd);
    prevMonthStart.setDate(1);
    prevMonthStart.setHours(0, 0, 0, 0);
    const prevMonthStartISO = prevMonthStart.toISOString();
    const prevMonthEndISO = prevMonthEnd.toISOString();

    const [pedidosHoje, pedidosMes, pedidosMesAnt, pedidosAcumulado, pagar, receber] = await Promise.all([
      supabase.from("pedido").select("total, status, origem").gte("data", today),
      supabase.from("pedido").select("total, status, origem").gte("data", monthStartISO),
      supabase.from("pedido").select("total, status").gte("data", prevMonthStartISO).lte("data", prevMonthEndISO),
      supabase.from("pedido").select("total, status, origem"),
      supabase.from("contas_pagar").select("valor").eq("pago", false),
      supabase.from("contas_receber").select("valor").eq("recebido", false),
    ]);

    const filterValid = (data: any[]) => (data || []).filter((p: any) => p.status !== "carrinho");
    const filterActive = (data: any[]) => data.filter((p: any) => p.status !== "cancelado");

    const pedidosHojeData = filterValid(pedidosHoje.data);
    const pedidosMesData = filterValid(pedidosMes.data);
    const pedidosMesAntData = filterValid(pedidosMesAnt.data);
    const pedidosAcumuladoData = filterValid(pedidosAcumulado.data);

    const sumTotal = (data: any[]) => filterActive(data).reduce((s: number, p: any) => s + Number(p.total), 0);
    const countActive = (data: any[]) => filterActive(data).length;

    // Origem breakdown: hoje, mês, acumulado
    const origemMap: Record<string, OrigemFat> = {};
    const addOrigem = (data: any[], key: "Hoje" | "Mes" | "Acumulado") => {
      filterActive(data).forEach((p: any) => {
        const o = p.origem || "web";
        if (!origemMap[o]) origemMap[o] = { origem: o, totalHoje: 0, qtdHoje: 0, totalMes: 0, qtdMes: 0, totalAcumulado: 0, qtdAcumulado: 0 };
        if (key === "Hoje") { origemMap[o].totalHoje += Number(p.total); origemMap[o].qtdHoje += 1; }
        if (key === "Mes") { origemMap[o].totalMes += Number(p.total); origemMap[o].qtdMes += 1; }
        if (key === "Acumulado") { origemMap[o].totalAcumulado += Number(p.total); origemMap[o].qtdAcumulado += 1; }
      });
    };
    addOrigem(pedidosHojeData, "Hoje");
    addOrigem(pedidosMesData, "Mes");
    addOrigem(pedidosAcumuladoData, "Acumulado");
    setOrigemFat(Object.values(origemMap).sort((a, b) => b.totalMes - a.totalMes));

    // Status resumo
    const targetStatuses = ["separacao", "aguardando_pagamento", "pago"];
    const sMap: Record<string, { qtd: number; total: number }> = {};
    targetStatuses.forEach(s => { sMap[s] = { qtd: 0, total: 0 }; });
    pedidosMesData.forEach((p: any) => {
      if (targetStatuses.includes(p.status)) {
        sMap[p.status].qtd += 1;
        sMap[p.status].total += Number(p.total);
      }
    });
    setStatusResumo(targetStatuses.map(s => ({ status: s, ...sMap[s] })));

    const pagarData = pagar.data || [];
    const receberData = receber.data || [];

    setStats({
      pedidosHoje: countActive(pedidosHojeData),
      faturamento: sumTotal(pedidosHojeData),
      pedidosMes: countActive(pedidosMesData),
      faturamentoMes: sumTotal(pedidosMesData),
      pedidosMesAnt: countActive(pedidosMesAntData),
      faturamentoMesAnt: sumTotal(pedidosMesAntData),
      totalPagar: pagarData.reduce((s: number, r: any) => s + Number(r.valor), 0),
      qtdPagar: pagarData.length,
      totalReceber: receberData.reduce((s: number, r: any) => s + Number(r.valor), 0),
      qtdReceber: receberData.length,
    });

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const totalAndamento = statusResumo.reduce((a, s) => a + s.qtd, 0);

  if (loading) {
    return (
      <div className="space-y-4 pb-6">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-48 mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const content = (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Resumo geral</p>
      </div>

      {/* KPI grid – 2x3 mobile, 3-col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Pedidos hoje */}
        <Link to="/admin/pedidos" className="rounded-xl bg-card border border-border p-3.5 space-y-1 hover:border-primary/40 transition-colors group active:scale-[0.98]">
          <div className="flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Hoje</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-foreground leading-none">{stats.pedidosHoje}</p>
          <p className="text-xs text-muted-foreground truncate">{fmt(stats.faturamento)}</p>
        </Link>

        {/* Pedidos mês */}
        <Link to="/admin/pedidos" className="rounded-xl bg-card border border-border p-3.5 space-y-1 hover:border-primary/40 transition-colors group active:scale-[0.98]">
          <div className="flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Mês</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-foreground leading-none">{stats.pedidosMes}</p>
          <p className="text-xs text-muted-foreground truncate">{fmt(stats.faturamentoMes)}</p>
        </Link>

        {/* Pedidos mês anterior */}
        <Link to="/admin/pedidos" className="rounded-xl bg-card border border-border p-3.5 space-y-1 hover:border-primary/40 transition-colors group active:scale-[0.98]">
          <div className="flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarMinus className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Mês anterior</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-foreground leading-none">{stats.pedidosMesAnt}</p>
          <p className="text-xs text-muted-foreground truncate">{fmt(stats.faturamentoMesAnt)}</p>
        </Link>

        {/* Contas a receber */}
        <Link to="/admin/financeiro" className="rounded-xl bg-[hsl(var(--success))]/5 border border-[hsl(var(--success))]/20 p-3.5 space-y-1 hover:border-[hsl(var(--success))]/40 transition-colors group active:scale-[0.98]">
          <div className="flex items-center justify-between text-[hsl(var(--success))]">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">A receber</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-[hsl(var(--success))] leading-none truncate">{fmt(stats.totalReceber)}</p>
          <p className="text-[11px] text-muted-foreground">{stats.qtdReceber} pendente(s)</p>
        </Link>

        {/* Contas a pagar */}
        <Link to="/admin/financeiro" className="rounded-xl bg-destructive/5 border border-destructive/20 p-3.5 space-y-1 hover:border-destructive/40 transition-colors group active:scale-[0.98]">
          <div className="flex items-center justify-between text-destructive">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">A pagar</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-destructive leading-none truncate">{fmt(stats.totalPagar)}</p>
          <p className="text-[11px] text-muted-foreground">{stats.qtdPagar} pendente(s)</p>
        </Link>
      </div>

      {/* Pedidos em andamento */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <Link to="/admin/pedidos" className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Pedidos em andamento</h2>
          </div>
          <div className="flex items-center gap-2">
            {totalAndamento > 0 && (
              <Badge variant="secondary" className="text-[11px] font-bold px-2 py-0.5">
                {totalAndamento}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
        {statusResumo.every(s => s.qtd === 0) ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum pedido em andamento
          </div>
        ) : (
          <div className="divide-y divide-border">
            {statusResumo.map((s) => (
              <div key={s.status} className="flex items-center justify-between px-4 py-3 gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${STATUS_COLORS[s.status] || ""}`}>
                  {STATUS_LABELS[s.status] || s.status}
                </span>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-sm font-medium text-foreground tabular-nums">{s.qtd}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground tabular-nums min-w-0 truncate">{fmt(s.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Faturamento por origem – tabela hoje / mês / acumulado */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <Link to="/admin/pedidos" className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Faturamento por origem</h2>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        {origemFat.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum pedido registrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-wide">Origem</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[11px] uppercase tracking-wide">Hoje</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[11px] uppercase tracking-wide">Mês</th>
                  <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wide">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {origemFat.map((o) => {
                  const Icon = ORIGEM_ICONS[o.origem] || Globe;
                  return (
                    <tr key={o.origem}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground">{ORIGEM_LABELS[o.origem] || o.origem}</span>
                        </div>
                      </td>
                      <td className="text-right px-3 py-3">
                        <div className="tabular-nums text-foreground font-medium">{fmt(o.totalHoje)}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">{o.qtdHoje} ped.</div>
                      </td>
                      <td className="text-right px-3 py-3">
                        <div className="tabular-nums text-foreground font-medium">{fmt(o.totalMes)}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">{o.qtdMes} ped.</div>
                      </td>
                      <td className="text-right px-4 py-3">
                        <div className="tabular-nums text-foreground font-medium">{fmt(o.totalAcumulado)}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">{o.qtdAcumulado} ped.</div>
                      </td>
                    </tr>
                  );
                })}
                {/* Totais */}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-4 py-3 text-foreground">Total</td>
                  <td className="text-right px-3 py-3 tabular-nums text-foreground">
                    {fmt(origemFat.reduce((a, o) => a + o.totalHoje, 0))}
                  </td>
                  <td className="text-right px-3 py-3 tabular-nums text-foreground">
                    {fmt(origemFat.reduce((a, o) => a + o.totalMes, 0))}
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums text-foreground">
                    {fmt(origemFat.reduce((a, o) => a + o.totalAcumulado, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={handleRefresh} enabled={isMobile}>
      {content}
    </PullToRefresh>
  );
};

export default Dashboard;
