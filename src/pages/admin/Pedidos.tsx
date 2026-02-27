import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Truck, Store, Clock, CalendarIcon } from "lucide-react";
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
  const allowed: string[] = [currentStatus];
  if (currentIdx < statusOrder.length - 1) {
    allowed.push(statusOrder[currentIdx + 1]);
  }
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
  quantidade: number;
  preco_unitario: number;
  produto: { nome: string } | null;
}

interface StatusHistorico {
  pedido_status_historico_id: string;
  status: string;
  data: string;
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
  // Payment fields
  const [formasPagamento, setFormasPagamento] = useState<{ forma_pagamento_id: string; nome: string }[]>([]);
  const [bancos, setBancos] = useState<{ banco_id: string; nome: string }[]>([]);
  const [pagFormaId, setPagFormaId] = useState("");
  const [pagBancoId, setPagBancoId] = useState("");
  const [pagData, setPagData] = useState<Date | undefined>(undefined);
  const [pagValor, setPagValor] = useState("");
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from("pedido")
      .select("pedido_id, data, total, frete, status, origem, observacao, local_estoque_id, cliente!pedido_cliente_id_fkey(nome), local_estoque(nome)")
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
    setPagData(undefined);
    setPagValor(Number(p.total).toFixed(2));
    const [itemsRes, histRes] = await Promise.all([
      supabase
        .from("pedido_item")
        .select("pedido_item_id, quantidade, preco_unitario, produto(nome)")
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
  const needsPaymentInfo = editStatus === "aguardando_pagamento" && selectedPedido?.status !== "aguardando_pagamento";

  const updatePedido = async () => {
    if (!selectedPedido) return;

    // For delivery orders: require frete before leaving separacao
    if (isEntrega && editStatus !== "separacao" && editStatus !== "carrinho" && editStatus !== "cancelado" && freteNum <= 0) {
      toast({ title: "Informe o valor do frete para pedidos de entrega", variant: "destructive" });
      return;
    }

    // Require payment info when moving to aguardando_pagamento
    if (needsPaymentInfo) {
      if (!pagFormaId || !pagBancoId || !pagData) {
        toast({ title: "Preencha forma de pagamento, banco e data", variant: "destructive" });
        return;
      }
    }

    setLoading(true);

    const itemsTotal = items.reduce((sum, i) => sum + Number(i.preco_unitario) * Number(i.quantidade), 0);
    const newTotal = itemsTotal + freteNum;

    const updateData: any = { frete: freteNum, total: newTotal };
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

      // Insert payment record
      if (needsPaymentInfo) {
        await supabase.from("pedido_pagamento").insert({
          pedido_id: selectedPedido.pedido_id,
          forma_pagamento_id: pagFormaId,
          banco_id: pagBancoId,
          data_pagamento: pagData!.toISOString(),
          valor: newTotal,
        });
      }

      toast({ title: "Pedido atualizado" });
      setDialogOpen(false);
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

              {/* Status History */}
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

              {/* Frete (for delivery orders) */}
              {isEntrega && (
                <div className="space-y-2">
                  <Label>Valor do Frete (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFrete}
                    onChange={(e) => setEditFrete(e.target.value)}
                    placeholder="0.00"
                  />
                  {freteNum > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Novo total: R$ {(items.reduce((s, i) => s + Number(i.preco_unitario) * Number(i.quantidade), 0) + freteNum).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <Separator />
              <div className="space-y-2">
                <Label>Alterar Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedStatuses.map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment fields when moving to aguardando_pagamento */}
              {needsPaymentInfo && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <Label className="font-semibold">Dados do Pagamento</Label>
                  <div className="space-y-2">
                    <Label>Forma de Pagamento *</Label>
                    <Select value={pagFormaId} onValueChange={setPagFormaId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {formasPagamento.map((f) => <SelectItem key={f.forma_pagamento_id} value={f.forma_pagamento_id}>{f.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Banco *</Label>
                    <Select value={pagBancoId} onValueChange={setPagBancoId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {bancos.map((b) => <SelectItem key={b.banco_id} value={b.banco_id}>{b.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
            <Button onClick={updatePedido} disabled={loading || (editStatus === selectedPedido?.status && editFrete === Number(selectedPedido?.frete || 0).toFixed(2))}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pedidos;
