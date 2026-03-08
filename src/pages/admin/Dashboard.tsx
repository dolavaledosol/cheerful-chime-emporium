import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingCart, DollarSign, TrendingDown, TrendingUp,
  CalendarDays, BarChart3, ClipboardList, Globe, MessageCircle, Monitor,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import PullToRefresh from "@/components/shared/PullToRefresh";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type OrigemFat = { origem: string; total: number; qtd: number };
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

    const [pedidosHoje, pedidosMes, pagar, receber] = await Promise.all([
      supabase.from("pedido").select("total, status").gte("data", today),
      supabase.from("pedido").select("total, status, origem").gte("data", monthStartISO),
      supabase.from("contas_pagar").select("valor").eq("pago", false),
      supabase.from("contas_receber").select("valor").eq("recebido", false),
    ]);

    const pedidosHojeData = (pedidosHoje.data || []).filter((p: any) => p.status !== "carrinho");
    const pedidosMesData = (pedidosMes.data || []).filter((p: any) => p.status !== "carrinho");

    const faturamentoHoje = pedidosHojeData
      .filter((p: any) => p.status !== "cancelado")
      .reduce((s: number, p: any) => s + Number(p.total), 0);

    const faturamentoMes = pedidosMesData
      .filter((p: any) => p.status !== "cancelado")
      .reduce((s: number, p: any) => s + Number(p.total), 0);

    const origemMap: Record<string, { total: number; qtd: number }> = {};
    pedidosMesData
      .filter((p: any) => p.status !== "cancelado")
      .forEach((p: any) => {
        const o = p.origem || "web";
        if (!origemMap[o]) origemMap[o] = { total: 0, qtd: 0 };
        origemMap[o].total += Number(p.total);
        origemMap[o].qtd += 1;
      });
    setOrigemFat(
      Object.entries(origemMap).map(([origem, v]) => ({ origem, ...v }))
        .sort((a, b) => b.total - a.total)
    );

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
      pedidosHoje: pedidosHojeData.length,
      faturamento: faturamentoHoje,
      pedidosMes: pedidosMesData.filter((p: any) => p.status !== "cancelado").length,
      faturamentoMes,
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
  const maxOrigemTotal = Math.max(...origemFat.map(x => x.total), 1);
  const totalOrigemFat = origemFat.reduce((a, o) => a + o.total, 0);

  if (loading) {
    return (
      <div className="space-y-4 pb-6">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-48 mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
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
        <p className="text-xs text-muted-foreground mt-0.5">Resumo do mês atual</p>
      </div>

      {/* KPI grid – 2x2 mobile, 4-col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{fmt(stats.faturamento)}</p>
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
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{fmt(stats.faturamentoMes)}</p>
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

      {/* Faturamento por origem – visual bar chart on mobile */}
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
            Nenhum pedido no mês
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Horizontal bar chart */}
            {origemFat.map((o) => {
              const Icon = ORIGEM_ICONS[o.origem] || Globe;
              const pct = maxOrigemTotal > 0 ? (o.total / maxOrigemTotal) * 100 : 0;
              const share = totalOrigemFat > 0 ? ((o.total / totalOrigemFat) * 100).toFixed(0) : "0";

              return (
                <div key={o.origem} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground">{ORIGEM_LABELS[o.origem] || o.origem}</span>
                      <span className="text-[11px] text-muted-foreground">({o.qtd}) · {share}%</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums shrink-0 ml-2">{fmt(o.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
