import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Truck, Store, Clock, CalendarIcon, AlertTriangle, Split } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";


const statusOptions = [
  "carrinho", "separacao", "aguardando_pagamento", "pago", "enviado", "entregue", "cancelado",
] as const;

const statusOrder = ["carrinho", "separacao", "aguardando_pagamento", "pago", "enviado", "entregue"];

function getAllowedNextStatuses(currentStatus: string): string[] {
  const currentIdx = statusOrder.indexOf(currentStatus);
  if (currentIdx === -1) return [currentStatus, "cancelado"];
  const allowed: string[] = [];
  if (currentIdx > 0) allowed.push(statusOrder[currentIdx - 1]);
  allowed.push(currentStatus);
  if (currentIdx < statusOrder.length - 1) allowed.push(statusOrder[currentIdx + 1]);
  if (currentStatus !== "cancelado") allowed.push("cancelado");
  return allowed;
}

const statusLabels: Record<string, string> = {
  carrinho: "Carrinho", separacao: "Separação", aguardando_pagamento: "Aguardando Pgto",
  pago: "Pago", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado",
};

const statusColors: Record<string, string> = {
  carrinho: "bg-muted text-muted-foreground", separacao: "bg-yellow-100 text-yellow-800",
  aguardando_pagamento: "bg-orange-100 text-orange-800", pago: "bg-green-100 text-green-700",
  enviado: "bg-blue-100 text-blue-700", entregue: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100 text-red-700",
};

interface Pedido {
  pedido_id: string;
  cliente_id: string;
  data: string;
  total: number;
  frete: number;
  status: string;
  origem: string;
  observacao: string | null;
  local_estoque_id: string | null;
  cliente: { nome: string } | null;
  local_estoque: { nome: string } | null;
}

interface PedidoItem {
  pedido_item_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  produto: { nome: string } | null;
}

interface StatusHistorico {
  pedido_status_historico_id: string;
  status: string;
  data: string;
}

interface StockIssue {
  produto_id: string;
  produto_nome: string;
  quantidade_pedida: number;
  quantidade_disponivel: number;
  faltante: number;
}

function getTipoEntrega(p: Pedido): { label: string; icon: typeof Truck } {
  if (p.local_estoque_id) return { label: "Retirada", icon: Store };
  return { label: "Entrega", icon: Truck };
}

const Pedidos = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [historico, setHistorico] = useState<StatusHistorico[]>([]);
  const [editStatus, setEditStatus] = useState("");
  const [editFrete, setEditFrete] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  // Payment fields
  const [formasPagamento, setFormasPagamento] = useState<{ forma_pagamento_id: string; nome: string }[]>([]);
  const [bancos, setBancos] = useState<{ banco_id: string; nome: string }[]>([]);
  const [pagFormaId, setPagFormaId] = useState("");
  const [pagBancoId, setPagBancoId] = useState("");
  const [pagData, setPagData] = useState<Date | undefined>(undefined);
  
  // Stock issue dialog
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [stockCheckPassed, setStockCheckPassed] = useState(false);
  const [splitSelectedItems, setSplitSelectedItems] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from("pedido")
      .select("pedido_id, cliente_id, data, total, frete, status, origem, observacao, local_estoque_id, cliente!pedido_cliente_id_fkey(nome), local_estoque(nome)")
      .order("data", { ascending: false });
    if (data) setPedidos(data as any);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const loadAux = async () => {
      const [fpRes, bRes] = await Promise.all([
        supabase.from("forma_pagamento").select("forma_pagamento_id, nome").eq("ativo", true).order("nome"),
        supabase.from("banco").select("banco_id, nome").eq("ativo", true).order("nome"),
      ]);
      if (fpRes.data) setFormasPagamento(fpRes.data);
      if (bRes.data) setBancos(bRes.data);
    };
    loadAux();
  }, []);

  const filtered = pedidos.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch = !term || p.cliente?.nome?.toLowerCase().includes(term) || p.pedido_id.includes(term);
    const matchStatus = statusFilter === "todos" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openDetails = async (p: Pedido) => {
    setSelectedPedido(p);
    setEditStatus(p.status);
    setEditFrete(Number(p.frete).toFixed(2));
    setPagFormaId("");
    setPagBancoId("");
    setPagData(new Date());
    
    setStockIssues([]);
    setAllowNegativeStock(false);
    setStockCheckPassed(false);
    setSplitSelectedItems({});
    setStockDialogOpen(false);
    const [itemsRes, histRes] = await Promise.all([
      supabase
        .from("pedido_item")
        .select("pedido_item_id, produto_id, quantidade, preco_unitario, produto(nome)")
        .eq("pedido_id", p.pedido_id),
      supabase
        .from("pedido_status_historico")
        .select("pedido_status_historico_id, status, data")
        .eq("pedido_id", p.pedido_id)
        .order("data", { ascending: true }),
    ]);
    setItems((itemsRes.data as any) || []);
    setHistorico((histRes.data as any) || []);
    setDialogOpen(true);
  };

  const isEntrega = selectedPedido ? !selectedPedido.local_estoque_id : false;
  const freteNum = parseFloat(editFrete) || 0;
  const allowedStatuses = selectedPedido ? getAllowedNextStatuses(selectedPedido.status) : [];
  const needsPaymentInfo = editStatus === "pago" && selectedPedido?.status === "aguardando_pagamento" && stockCheckPassed;
  const currentIdx = selectedPedido ? statusOrder.indexOf(selectedPedido.status) : -1;
  const editIdx = statusOrder.indexOf(editStatus);
  const isGoingBack = editIdx !== -1 && currentIdx !== -1 && editIdx < currentIdx;
  const isAfterPago = currentIdx >= statusOrder.indexOf("pago");
  const shouldDeletePayment = isGoingBack && currentIdx >= statusOrder.indexOf("pago") && editIdx < statusOrder.indexOf("pago");

  const handleStatusClick = async (s: string) => {
    if (s === "cancelado") {
      setConfirmCancelOpen(true);
    } else if (s === "pago" && selectedPedido?.status === "aguardando_pagamento") {
      // Check stock before showing payment form
      setEditStatus(s);
      setStockCheckPassed(false);
      const issues = await checkStock();
      if (issues.length > 0) {
        setStockIssues(issues);
        // Pre-select items with stock issues
        const preSelected: Record<string, boolean> = {};
        issues.forEach(i => { preSelected[i.produto_id] = true; });
        setSplitSelectedItems(preSelected);
        setStockDialogOpen(true);
      } else {
        setStockCheckPassed(true);
      }
    } else {
      setEditStatus(s);
      setStockCheckPassed(false);
    }
  };

  const confirmCancel = () => {
    setEditStatus("cancelado");
    setConfirmCancelOpen(false);
  };

  // Check stock availability for all items
  const checkStock = async (): Promise<StockIssue[]> => {
    if (!selectedPedido) return [];
    const issues: StockIssue[] = [];

    for (const item of items) {
      // Get available stock across all locations (or specific location for pickup)
      let query = supabase
        .from("estoque_local")
        .select("quantidade_disponivel")
        .eq("produto_id", item.produto_id);

      if (selectedPedido.local_estoque_id) {
        query = query.eq("local_estoque_id", selectedPedido.local_estoque_id);
      }

      const { data: stockData } = await query;
      const totalAvailable = (stockData || []).reduce((sum, s) => sum + Number(s.quantidade_disponivel), 0);

      if (totalAvailable < Number(item.quantidade)) {
        issues.push({
          produto_id: item.produto_id,
          produto_nome: item.produto?.nome || "—",
          quantidade_pedida: Number(item.quantidade),
          quantidade_disponivel: totalAvailable,
          faltante: Number(item.quantidade) - totalAvailable,
        });
      }
    }
    return issues;
  };

  // Deduct stock
  const deductStock = async () => {
    if (!selectedPedido) return;

    for (const item of items) {
      let remaining = Number(item.quantidade);

      let query = supabase
        .from("estoque_local")
        .select("estoque_local_id, quantidade_disponivel, local_estoque_id")
        .eq("produto_id", item.produto_id)
        .order("quantidade_disponivel", { ascending: false });

      if (selectedPedido.local_estoque_id) {
        query = query.eq("local_estoque_id", selectedPedido.local_estoque_id);
      }

      const { data: stocks } = await query;
      if (!stocks) continue;

      for (const stock of stocks) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, Number(stock.quantidade_disponivel));
        await supabase
          .from("estoque_local")
          .update({ quantidade_disponivel: Number(stock.quantidade_disponivel) - (allowNegativeStock ? remaining : deduct) })
          .eq("estoque_local_id", stock.estoque_local_id);
        remaining -= allowNegativeStock ? remaining : deduct;
      }
    }
  };

  // Split order: create new order with selected items (full qty)
  const splitOrder = async (selectedProductIds: string[]) => {
    if (!selectedPedido || selectedProductIds.length === 0) return;

    const splitItems = items.filter(i => selectedProductIds.includes(i.produto_id));
    const newOrderTotal = splitItems.reduce((sum, i) => sum + Number(i.preco_unitario) * Number(i.quantidade), 0);

    const { data: newOrder, error: orderError } = await supabase
      .from("pedido")
      .insert({
        cliente_id: selectedPedido.cliente_id,
        local_estoque_id: selectedPedido.local_estoque_id,
        total: newOrderTotal,
        frete: 0,
        status: "separacao" as any,
        origem: selectedPedido.origem as any,
        observacao: `Desmembrado do pedido ${selectedPedido.pedido_id.slice(0, 8)}`,
      })
      .select("pedido_id")
      .single();

    if (orderError || !newOrder) {
      toast({ title: "Erro ao criar pedido desmembrado", description: orderError?.message, variant: "destructive" });
      return;
    }

    // Insert items into new order
    const newItems = splitItems.map(item => ({
      pedido_id: newOrder.pedido_id,
      produto_id: item.produto_id,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
    }));
    await supabase.from("pedido_item").insert(newItems);

    // Add status history for new order
    await supabase.from("pedido_status_historico").insert({
      pedido_id: newOrder.pedido_id,
      status: "separacao" as any,
    });

    // Remove split items from original order
    for (const item of splitItems) {
      await supabase.from("pedido_item").delete().eq("pedido_item_id", item.pedido_item_id);
    }

    // Update local items state to reflect remaining
    const remainingItems = items.filter(i => !selectedProductIds.includes(i.produto_id));
    setItems(remainingItems);

    // Create conta a receber for the new split order
    const today = new Date().toISOString().slice(0, 10);
    const splitItemNames = splitItems.map(i => i.produto?.nome || "Produto").join(", ");
    const descricao = `Desmembrado: ${splitItemNames}`.slice(0, 200);
    await supabase.from("contas_receber").insert({
      pedido_id: newOrder.pedido_id,
      cliente_id: selectedPedido.cliente_id,
      descricao,
      valor: newOrderTotal,
      data_vencimento: today,
      recebido: false,
      data_recebimento: null,
    });

    toast({ title: `Pedido desmembrado`, description: `Novo pedido criado com ${splitItems.length} item(ns) — R$ ${newOrderTotal.toFixed(2)}` });
  };

  // Create contas_receber entry
  const createContaReceber = async (pedidoId: string, clienteId: string, valor: number, dataPagamento: Date) => {
    await supabase.from("contas_receber").insert({
      pedido_id: pedidoId,
      cliente_id: clienteId,
      descricao: `Pedido ${pedidoId.slice(0, 8)}`,
      valor,
      data_vencimento: dataPagamento.toISOString().slice(0, 10),
      recebido: false,
      data_recebimento: null,
      banco_id: pagBancoId || null,
    });
  };

  const updatePedido = async () => {
    if (!selectedPedido) return;

    // For delivery orders: require frete before leaving separacao
    if (isEntrega && editStatus !== "separacao" && editStatus !== "carrinho" && editStatus !== "cancelado" && freteNum <= 0) {
      toast({ title: "Informe o valor do frete para pedidos de entrega", variant: "destructive" });
      return;
    }

    // Require payment info when moving to pago
    if (needsPaymentInfo) {
      if (!pagFormaId || !pagBancoId || !pagData) {
        toast({ title: "Preencha forma de pagamento, banco e data", variant: "destructive" });
        return;
      }
    }

    setLoading(true);

    const itemsTotal = items.reduce((sum, i) => sum + Number(i.preco_unitario) * Number(i.quantidade), 0);
    let newTotal = itemsTotal + freteNum;

    const updateData: any = isAfterPago ? {} : { frete: freteNum, total: newTotal };
    if (editStatus !== selectedPedido.status) {
      updateData.status = editStatus;
    }

    const { error } = await supabase.from("pedido").update(updateData).eq("pedido_id", selectedPedido.pedido_id);
    if (!error) {
      if (editStatus !== selectedPedido.status) {
        await supabase.from("pedido_status_historico").insert({
          pedido_id: selectedPedido.pedido_id,
          status: editStatus as any,
        });
      }

      // Insert payment record and handle stock when moving to pago
      if (needsPaymentInfo) {
        // Deduct stock

        await supabase.from("pedido_pagamento").insert({
          pedido_id: selectedPedido.pedido_id,
          forma_pagamento_id: pagFormaId,
          banco_id: pagBancoId,
          data_pagamento: pagData!.toISOString(),
          valor: newTotal,
        });

        // Create contas_receber for original order
        await createContaReceber(selectedPedido.pedido_id, selectedPedido.cliente_id, newTotal, pagData!);
      }

      // Delete payments & contas_receber when going back to separacao
      if (shouldDeletePayment) {
        await supabase.from("pedido_pagamento").delete().eq("pedido_id", selectedPedido.pedido_id);
        await supabase.from("contas_receber").delete().eq("pedido_id", selectedPedido.pedido_id);
      }

      toast({ title: "Pedido atualizado" });
      setDialogOpen(false);
      setStockDialogOpen(false);
      load();
    } else {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Pedido</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
            ) : filtered.map((p) => {
              const tipo = getTipoEntrega(p);
              const TipoIcon = tipo.icon;
              return (
                <TableRow key={p.pedido_id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{p.pedido_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{format(new Date(p.data), "dd/MM/yy HH:mm")}</TableCell>
                  <TableCell className="font-medium">{p.cliente?.nome || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <TipoIcon className="h-3 w-3" /> {tipo.label}
                    </span>
                  </TableCell>
                  <TableCell>R$ {Number(p.total).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[p.status]}>{statusLabels[p.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openDetails(p)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido {selectedPedido?.pedido_id.slice(0, 8)}</DialogTitle>
            <DialogDescription>Detalhes e histórico do pedido</DialogDescription>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> {selectedPedido.cliente?.nome}</div>
                <div><span className="text-muted-foreground">Data:</span> {format(new Date(selectedPedido.data), "dd/MM/yy HH:mm")}</div>
                <div><span className="text-muted-foreground">Total:</span> R$ {Number(selectedPedido.total).toFixed(2)}</div>
                <div><span className="text-muted-foreground">Frete:</span> R$ {Number(selectedPedido.frete).toFixed(2)}</div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  {(() => {
                    const tipo = getTipoEntrega(selectedPedido);
                    const TipoIcon = tipo.icon;
                    return (
                      <span className="inline-flex items-center gap-1">
                        <TipoIcon className="h-3 w-3" /> {tipo.label}
                        {selectedPedido.local_estoque?.nome && ` — ${selectedPedido.local_estoque.nome}`}
                      </span>
                    );
                  })()}
                </div>
              </div>
              {selectedPedido.observacao && <p className="text-sm text-muted-foreground">Obs: {selectedPedido.observacao}</p>}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Qtd</TableHead><TableHead>Preço</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={i.pedido_item_id}>
                        <TableCell className="text-sm">{i.produto?.nome || "—"}</TableCell>
                        <TableCell>{i.quantidade}</TableCell>
                        <TableCell>R$ {Number(i.preco_unitario).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {historico.length > 0 && (
                <div className="space-y-2">
                  <Separator />
                  <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Histórico de Status</Label>
                  <div className="space-y-1.5">
                    {historico.map((h) => (
                      <div key={h.pedido_status_historico_id} className="flex items-center justify-between text-sm border rounded-md px-3 py-1.5">
                        <Badge variant="outline" className={statusColors[h.status] || ""}>
                          {statusLabels[h.status] || h.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(h.data), "dd/MM/yy HH:mm")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isEntrega && (
                <div className="space-y-2">
                  <Label>Valor do Frete (R$)</Label>
                  {isAfterPago ? (
                    <p className="text-sm font-medium">R$ {Number(selectedPedido.frete).toFixed(2)}</p>
                  ) : (
                    <>
                      <Input type="number" step="0.01" min="0" value={editFrete} onChange={(e) => setEditFrete(e.target.value)} placeholder="0.00" />
                      {freteNum > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Novo total: R$ {(items.reduce((s, i) => s + Number(i.preco_unitario) * Number(i.quantidade), 0) + freteNum).toFixed(2)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <Separator />
              <div className="space-y-2">
                <Label>Alterar Status</Label>
                <div className="flex flex-wrap gap-2">
                  {allowedStatuses.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={editStatus === s ? "default" : "outline"}
                      className={cn(
                        editStatus === s && s !== "cancelado" && statusColors[s],
                        s === "cancelado" && editStatus === s && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                      )}
                      onClick={() => handleStatusClick(s)}
                    >
                      {statusLabels[s]}
                    </Button>
                  ))}
                </div>
              </div>

              {needsPaymentInfo && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <Label className="font-semibold">Dados do Pagamento</Label>
                  <div className="space-y-2">
                    <Label>Forma de Pagamento *</Label>
                    <div className="flex flex-wrap gap-2">
                      {formasPagamento.map((f) => (
                        <Button key={f.forma_pagamento_id} type="button" size="sm" variant={pagFormaId === f.forma_pagamento_id ? "default" : "outline"} onClick={() => setPagFormaId(f.forma_pagamento_id)}>
                          {f.nome}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Banco *</Label>
                    <div className="flex flex-wrap gap-2">
                      {bancos.map((b) => (
                        <Button key={b.banco_id} type="button" size="sm" variant={pagBancoId === b.banco_id ? "default" : "outline"} onClick={() => setPagBancoId(b.banco_id)}>
                          {b.nome}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Data do Pagamento *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !pagData && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {pagData ? format(pagData, "dd/MM/yyyy") : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={pagData} onSelect={setPagData} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <p className="text-sm font-medium">R$ {(items.reduce((s, i) => s + Number(i.preco_unitario) * Number(i.quantidade), 0) + freteNum).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Fechar</Button>
            <Button onClick={() => updatePedido()} disabled={loading || (editStatus === selectedPedido?.status && editFrete === Number(selectedPedido?.frete || 0).toFixed(2))}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar o pedido. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={stockDialogOpen} onOpenChange={(open) => {
        if (!open) setEditStatus(selectedPedido?.status || "");
        setStockDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Estoque insuficiente
            </DialogTitle>
            <DialogDescription>
              Selecione os itens que deseja mover para um novo pedido (desmembrar), ou permita estoque negativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8"><Split className="h-3 w-3" /></TableHead>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs text-center">Pedido</TableHead>
                    <TableHead className="text-xs text-center">Disponível</TableHead>
                    <TableHead className="text-xs text-center">Falta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const issue = stockIssues.find(i => i.produto_id === item.produto_id);
                    const hasIssue = !!issue;
                    return (
                      <TableRow key={item.produto_id} className={hasIssue ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={!!splitSelectedItems[item.produto_id]}
                            onCheckedChange={(checked) =>
                              setSplitSelectedItems(prev => ({ ...prev, [item.produto_id]: !!checked }))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs">{item.produto?.nome || "—"}</TableCell>
                        <TableCell className="text-xs text-center">{item.quantidade}</TableCell>
                        <TableCell className="text-xs text-center">
                          {issue ? issue.quantidade_disponivel : "OK"}
                        </TableCell>
                        <TableCell className="text-xs text-center text-destructive font-medium">
                          {issue ? issue.faltante : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setEditStatus(selectedPedido?.status || ""); setStockDialogOpen(false); }}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAllowNegativeStock(true);
                setSplitSelectedItems({});
                setStockCheckPassed(true);
                setStockDialogOpen(false);
              }}
              disabled={loading}
            >
              Permitir negativo
            </Button>
            <Button
              onClick={async () => {
                const selected = Object.keys(splitSelectedItems).filter(k => splitSelectedItems[k]);
                if (selected.length === 0) {
                  toast({ title: "Selecione ao menos um item para desmembrar", variant: "destructive" });
                  return;
                }
                if (selected.length === items.length) {
                  toast({ title: "Não é possível mover todos os itens", variant: "destructive" });
                  return;
                }
                setLoading(true);
                await splitOrder(selected);
                // Recalculate original order total (splitOrder already removed items from state)
                const remainingItems = items.filter(i => !selected.includes(i.produto_id));
                const remainingTotal = remainingItems.reduce((sum, i) => sum + Number(i.preco_unitario) * Number(i.quantidade), 0);
                const newOriginalTotal = remainingTotal + freteNum;
                await supabase.from("pedido").update({ total: newOriginalTotal }).eq("pedido_id", selectedPedido!.pedido_id);
                // Keep order at aguardando_pagamento, don't go to payment form
                setEditStatus(selectedPedido?.status || "aguardando_pagamento");
                setStockCheckPassed(false);
                setStockDialogOpen(false);
                setDialogOpen(false);
                setLoading(false);
                load();
                toast({ title: "Pedido desmembrado. Verifique o estoque novamente ao pagar." });
              }}
              disabled={loading}
            >
              Desmembrar selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pedidos;
