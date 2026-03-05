import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Check, Download } from "lucide-react";
import { format } from "date-fns";

/* ── Shared types ── */
interface Fornecedor { fornecedor_id: string; nome: string; }
interface Cliente { cliente_id: string; nome: string; }
interface Banco { banco_id: string; nome: string; }
interface FormaPagamento { forma_pagamento_id: string; nome: string; }


interface ContaPagar {
  contas_pagar_id: string; descricao: string; valor: number;
  data_vencimento: string; data_pagamento: string | null;
  pago: boolean; observacao: string | null;
  fornecedor_id: string | null; banco_id: string | null; forma_pagamento_id: string | null;
  fornecedor: { nome: string } | null; banco: { nome: string } | null; forma_pagamento: { nome: string } | null;
}

interface ContaReceber {
  contas_receber_id: string; descricao: string; valor: number;
  data_vencimento: string; data_recebimento: string | null;
  recebido: boolean; observacao: string | null;
  created_at: string;
  cliente_id: string | null; banco_id: string | null; pedido_id: string | null;
  cliente: { nome: string } | null; banco: { nome: string } | null;
  _forma: string; _banco_pag: string;
}

/* ── Empty forms ── */
const emptyPagar = {
  descricao: "", valor: "", data_vencimento: "", data_pagamento: "",
  pago: false, observacao: "", fornecedor_id: "", banco_id: "", forma_pagamento_id: "",
};
const emptyReceber = {
  descricao: "", valor: "", data_vencimento: "", data_recebimento: "",
  recebido: false, observacao: "", cliente_id: "", banco_id: "", pedido_id: "",
};

const Financeiro = () => {
  const { toast } = useToast();

  /* ── Lookup data ── */
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("fornecedor").select("fornecedor_id, nome").eq("ativo", true).order("nome"),
      supabase.from("cliente").select("cliente_id, nome").eq("ativo", true).order("nome"),
      supabase.from("banco").select("banco_id, nome").eq("ativo", true).order("nome"),
      supabase.from("forma_pagamento").select("forma_pagamento_id, nome").eq("ativo", true).order("nome"),
    ]).then(([f, c, b, fp]) => {
      if (f.data) setFornecedores(f.data);
      if (c.data) setClientes(c.data);
      if (b.data) setBancos(b.data);
      if (fp.data) setFormasPagamento(fp.data);
    });
  }, []);

  /* ═══════════════════════  CONTAS A PAGAR  ═══════════════════════ */
  const [pagar, setPagar] = useState<ContaPagar[]>([]);
  const [searchPagar, setSearchPagar] = useState("");
  const [dialogPagar, setDialogPagar] = useState(false);
  const [editPagarId, setEditPagarId] = useState<string | null>(null);
  const [formPagar, setFormPagar] = useState(emptyPagar);
  const [loadingPagar, setLoadingPagar] = useState(false);

  const loadPagar = async () => {
    const { data } = await supabase
      .from("contas_pagar")
      .select("*, fornecedor(nome), banco(nome), forma_pagamento(nome)")
      .order("data_vencimento", { ascending: false });
    if (data) setPagar(data as any);
  };

  useEffect(() => { loadPagar(); }, []);

  const filteredPagar = pagar.filter((c) => {
    const t = searchPagar.toLowerCase();
    return !t || c.descricao.toLowerCase().includes(t) || c.fornecedor?.nome?.toLowerCase().includes(t);
  });

  const openNewPagar = () => { setEditPagarId(null); setFormPagar(emptyPagar); setDialogPagar(true); };
  const openEditPagar = (c: ContaPagar) => {
    setEditPagarId(c.contas_pagar_id);
    setFormPagar({
      descricao: c.descricao, valor: String(c.valor), data_vencimento: c.data_vencimento,
      data_pagamento: c.data_pagamento || "", pago: c.pago, observacao: c.observacao || "",
      fornecedor_id: c.fornecedor_id || "", banco_id: c.banco_id || "", forma_pagamento_id: c.forma_pagamento_id || "",
    });
    setDialogPagar(true);
  };

  const savePagar = async () => {
    setLoadingPagar(true);
    const payload = {
      descricao: formPagar.descricao, valor: Number(formPagar.valor),
      data_vencimento: formPagar.data_vencimento,
      data_pagamento: formPagar.data_pagamento || null,
      pago: formPagar.pago, observacao: formPagar.observacao || null,
      fornecedor_id: formPagar.fornecedor_id || null,
      banco_id: formPagar.banco_id || null,
      forma_pagamento_id: formPagar.forma_pagamento_id || null,
    };
    const { error } = editPagarId
      ? await supabase.from("contas_pagar").update(payload).eq("contas_pagar_id", editPagarId).select()
      : await supabase.from("contas_pagar").insert(payload).select();
    setLoadingPagar(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editPagarId ? "Conta atualizada" : "Conta criada" });
    setDialogPagar(false);
    loadPagar();
  };

  const deletePagar = async (id: string) => {
    await supabase.from("contas_pagar").delete().eq("contas_pagar_id", id);
    toast({ title: "Conta removida" });
    loadPagar();
  };

  const marcarPago = async (id: string) => {
    await supabase.from("contas_pagar").update({ pago: true, data_pagamento: new Date().toISOString().slice(0, 10) }).eq("contas_pagar_id", id);
    toast({ title: "Marcado como pago" });
    loadPagar();
  };

  /* ═══════════════════════  CONTAS A RECEBER  ═══════════════════════ */
  const [receber, setReceber] = useState<ContaReceber[]>([]);
  const [searchReceber, setSearchReceber] = useState("");
  const [statusFilterReceber, setStatusFilterReceber] = useState<"pendente" | "recebido" | "todos">("pendente");
  const [dialogReceber, setDialogReceber] = useState(false);
  const [editReceberId, setEditReceberId] = useState<string | null>(null);
  const [formReceber, setFormReceber] = useState(emptyReceber);
  const [loadingReceber, setLoadingReceber] = useState(false);

  const loadReceber = async () => {
    const { data } = await supabase
      .from("contas_receber")
      .select("*, cliente(nome), banco(nome), pedido(pedido_id, data)")
      .order("created_at", { ascending: false });
    if (!data) { setReceber([]); return; }

    // Enrich with payment info from pedido_pagamento for entries linked to orders
    const pedidoIds = data.filter(d => d.pedido_id).map(d => d.pedido_id!);
    let pagMap: Record<string, { forma: string; banco: string }> = {};
    if (pedidoIds.length > 0) {
      const { data: pags } = await supabase
        .from("pedido_pagamento")
        .select("pedido_id, forma_pagamento(nome), banco(nome)")
        .in("pedido_id", pedidoIds);
      if (pags) {
        for (const p of pags as any[]) {
          if (!pagMap[p.pedido_id]) {
            pagMap[p.pedido_id] = {
              forma: p.forma_pagamento?.nome || "—",
              banco: p.banco?.nome || "—",
            };
          }
        }
      }
    }

    setReceber(data.map((d: any) => ({
      ...d,
      _forma: pagMap[d.pedido_id]?.forma || "—",
      _banco_pag: d.banco?.nome || pagMap[d.pedido_id]?.banco || "—",
    })) as any);
  };

  useEffect(() => { loadReceber(); }, []);

  const filteredReceber = receber.filter((c) => {
    const t = searchReceber.toLowerCase();
    const matchSearch = !t || c.descricao.toLowerCase().includes(t) || c.cliente?.nome?.toLowerCase().includes(t);
    const matchStatus = statusFilterReceber === "todos" || (statusFilterReceber === "recebido" ? c.recebido : !c.recebido);
    return matchSearch && matchStatus;
  });

  const openNewReceber = () => { setEditReceberId(null); setFormReceber(emptyReceber); setDialogReceber(true); };
  const openEditReceber = (c: ContaReceber) => {
    setEditReceberId(c.contas_receber_id);
    setFormReceber({
      descricao: c.descricao, valor: String(c.valor), data_vencimento: c.data_vencimento,
      data_recebimento: c.data_recebimento || new Date().toISOString().slice(0, 10), recebido: c.recebido, observacao: c.observacao || "",
      cliente_id: c.cliente_id || "", banco_id: c.banco_id || "", pedido_id: c.pedido_id || "",
    });
    setDialogReceber(true);
  };

  const saveReceber = async () => {
    setLoadingReceber(true);
    const payload = {
      descricao: formReceber.descricao, valor: Number(formReceber.valor),
      data_vencimento: formReceber.data_vencimento,
      data_recebimento: formReceber.data_recebimento || null,
      recebido: formReceber.recebido, observacao: formReceber.observacao || null,
      cliente_id: formReceber.cliente_id || null,
      banco_id: formReceber.banco_id || null,
      pedido_id: formReceber.pedido_id || null,
    };
    const { error, data: savedData } = editReceberId
      ? await supabase.from("contas_receber").update(payload).eq("contas_receber_id", editReceberId).select()
      : await supabase.from("contas_receber").insert(payload).select();
    if (!error && editReceberId && (!savedData || savedData.length === 0)) {
      setLoadingReceber(false);
      toast({ title: "Erro", description: "Nenhum registro foi atualizado. Verifique suas permissões.", variant: "destructive" });
      return;
    }
    setLoadingReceber(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editReceberId ? "Conta atualizada" : "Conta criada" });
    setDialogReceber(false);
    loadReceber();
  };


  const marcarRecebido = async (id: string) => {
    await supabase.from("contas_receber").update({ recebido: true, data_recebimento: new Date().toISOString().slice(0, 10) }).eq("contas_receber_id", id);
    toast({ title: "Marcado como recebido" });
    loadReceber();
  };

  /* ── Helpers ── */
  const fmtDate = (d: string | null) => d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—";
  const fmtMoney = (v: number) => `R$ ${Number(v).toFixed(2)}`;

  const exportReceber = async () => {
    // Buscar telefones verificados e WhatsApp de todos os clientes
    const clienteIds = [...new Set(filteredReceber.map((c) => c.cliente_id).filter(Boolean))] as string[];
    let phoneMap: Record<string, { from: string }> = {};
    if (clienteIds.length > 0) {
      const { data: phones } = await supabase
        .from("cliente_telefone")
        .select("cliente_id, from")
        .in("cliente_id", clienteIds)
        .eq("verificado", true)
        .eq("is_whatsapp", true);
      if (phones) {
        for (const p of phones) {
          // Pega o primeiro telefone verificado+whatsapp por cliente
          if (!phoneMap[p.cliente_id]) {
            phoneMap[p.cliente_id] = { from: p.from || "" };
          }
        }
      }
    }

    const headers = ["Código", "Cliente", "Cliente ID", "WhatsApp (from)", "Cód. Pedido", "Data Pedido", "Criação", "Vencimento", "Forma", "Banco", "Valor", "Status"];
    const rows = filteredReceber.map((c) => {
      const phone = c.cliente_id ? phoneMap[c.cliente_id] : null;
      const pedido = (c as any).pedido;
      return [
        c.contas_receber_id.slice(0, 8).toUpperCase(),
        c.cliente?.nome || "—",
        c.cliente_id || "—",
        phone?.from || "—",
        c.pedido_id ? c.pedido_id.slice(0, 8).toUpperCase() : "—",
        pedido?.data ? format(new Date(pedido.data), "dd/MM/yy HH:mm") : "—",
        format(new Date(c.created_at), "dd/MM/yy HH:mm"),
        fmtDate(c.data_vencimento),
        c._forma,
        c._banco_pag,
        Number(c.valor).toFixed(2).replace(".", ","),
        c.recebido ? "Recebido" : "Pendente",
      ];
    });
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas-receber-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      <Tabs defaultValue="pagar">
        <TabsList>
          <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
        </TabsList>

        {/* ══════════ TAB PAGAR ══════════ */}
        <TabsContent value="pagar" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchPagar} onChange={(e) => setSearchPagar(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={openNewPagar} className="gap-2"><Plus className="h-4 w-4" /> Nova Conta</Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead>Descrição</TableHead>
                   <TableHead className="hidden sm:table-cell">Fornecedor</TableHead>
                   <TableHead>Vencimento</TableHead>
                   <TableHead className="hidden md:table-cell">Forma</TableHead>
                   <TableHead>Valor</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="w-28">Ações</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPagar.length === 0 ? (
                   <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
                 ) : filteredPagar.map((c) => (
                  <TableRow key={c.contas_pagar_id}>
                    <TableCell className="font-medium">{c.descricao}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{c.fornecedor?.nome || "—"}</TableCell>
                     <TableCell>{fmtDate(c.data_vencimento)}</TableCell>
                     <TableCell className="hidden md:table-cell text-muted-foreground">{c.forma_pagamento?.nome || "—"}</TableCell>
                     <TableCell>{fmtMoney(c.valor)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.pago ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {c.pago ? "Pago" : "Pendente"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!c.pago && <Button variant="ghost" size="icon" onClick={() => marcarPago(c.contas_pagar_id)} title="Marcar pago"><Check className="h-4 w-4 text-green-600" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => openEditPagar(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePagar(c.contas_pagar_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ══════════ TAB RECEBER ══════════ */}
        <TabsContent value="receber" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-1 gap-2 items-center max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={searchReceber} onChange={(e) => setSearchReceber(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilterReceber} onValueChange={(v) => setStatusFilterReceber(v as any)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportReceber} className="gap-2"><Download className="h-4 w-4" /> Exportar</Button>
              <Button onClick={openNewReceber} className="gap-2"><Plus className="h-4 w-4" /> Nova Conta</Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Código</TableHead>
                   <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                   <TableHead>Criação</TableHead>
                   <TableHead>Vencimento</TableHead>
                   <TableHead className="hidden md:table-cell">Forma</TableHead>
                   <TableHead className="hidden md:table-cell">Banco</TableHead>
                   <TableHead>Valor</TableHead>
                   <TableHead>Status</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceber.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
                ) : filteredReceber.map((c) => {
                  return (
                  <TableRow key={c.contas_receber_id}>
                     <TableCell>
                       <button onClick={() => openEditReceber(c)} className="text-primary underline hover:text-primary/80 font-medium text-xs">
                         {c.contas_receber_id.slice(0, 8).toUpperCase()}
                       </button>
                     </TableCell>
                     <TableCell className="hidden sm:table-cell text-muted-foreground">{c.cliente?.nome || "—"}</TableCell>
                     <TableCell className="text-xs">{format(new Date(c.created_at), "dd/MM/yy HH:mm")}</TableCell>
                     <TableCell>{fmtDate(c.data_vencimento)}</TableCell>
                     <TableCell className="hidden md:table-cell text-muted-foreground">{c._forma}</TableCell>
                     <TableCell className="hidden md:table-cell text-muted-foreground">{c._banco_pag}</TableCell>
                     <TableCell>{fmtMoney(c.valor)}</TableCell>
                     <TableCell>
                       <span className={`text-xs px-2 py-0.5 rounded-full ${c.recebido ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                         {c.recebido ? "Recebido" : "Pendente"}
                       </span>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════ DIALOG PAGAR ══════════ */}
      <Dialog open={dialogPagar} onOpenChange={setDialogPagar}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPagarId ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Descrição *</Label><Input value={formPagar.descricao} onChange={(e) => setFormPagar({ ...formPagar, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={formPagar.valor} onChange={(e) => setFormPagar({ ...formPagar, valor: e.target.value })} /></div>
              <div className="space-y-2"><Label>Vencimento *</Label><Input type="date" value={formPagar.data_vencimento} onChange={(e) => setFormPagar({ ...formPagar, data_vencimento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={formPagar.fornecedor_id} onValueChange={(v) => setFormPagar({ ...formPagar, fornecedor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{fornecedores.map((f) => <SelectItem key={f.fornecedor_id} value={f.fornecedor_id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={formPagar.banco_id} onValueChange={(v) => setFormPagar({ ...formPagar, banco_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{bancos.map((b) => <SelectItem key={b.banco_id} value={b.banco_id}>{b.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma Pagamento</Label>
                <Select value={formPagar.forma_pagamento_id} onValueChange={(v) => setFormPagar({ ...formPagar, forma_pagamento_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{formasPagamento.map((fp) => <SelectItem key={fp.forma_pagamento_id} value={fp.forma_pagamento_id}>{fp.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data Pagamento</Label><Input type="date" value={formPagar.data_pagamento} onChange={(e) => setFormPagar({ ...formPagar, data_pagamento: e.target.value })} /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={formPagar.pago} onCheckedChange={(v) => setFormPagar({ ...formPagar, pago: v })} /><Label>Pago</Label></div>
            </div>
            <div className="space-y-2"><Label>Observação</Label><Input value={formPagar.observacao} onChange={(e) => setFormPagar({ ...formPagar, observacao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPagar(false)}>Cancelar</Button>
            <Button onClick={savePagar} disabled={loadingPagar || !formPagar.descricao || !formPagar.valor || !formPagar.data_vencimento}>{loadingPagar ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ DIALOG RECEBER ══════════ */}
      <Dialog open={dialogReceber} onOpenChange={setDialogReceber}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editReceberId ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Descrição *</Label><Input value={formReceber.descricao} onChange={(e) => setFormReceber({ ...formReceber, descricao: e.target.value })} disabled={!!editReceberId} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={formReceber.valor} onChange={(e) => setFormReceber({ ...formReceber, valor: e.target.value })} disabled={!!editReceberId} /></div>
              <div className="space-y-2"><Label>Vencimento *</Label><Input type="date" value={formReceber.data_vencimento} onChange={(e) => setFormReceber({ ...formReceber, data_vencimento: e.target.value })} disabled={!!editReceberId} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={formReceber.cliente_id} onValueChange={(v) => setFormReceber({ ...formReceber, cliente_id: v })} disabled={!!editReceberId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.cliente_id} value={c.cliente_id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={formReceber.banco_id} onValueChange={(v) => setFormReceber({ ...formReceber, banco_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{bancos.map((b) => <SelectItem key={b.banco_id} value={b.banco_id}>{b.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data Recebimento</Label><Input type="date" value={formReceber.data_recebimento} onChange={(e) => setFormReceber({ ...formReceber, data_recebimento: e.target.value })} /></div>
              <div className="flex items-center gap-2 pt-6"><Switch checked={formReceber.recebido} onCheckedChange={(v) => setFormReceber({ ...formReceber, recebido: v })} /><Label>Recebido</Label></div>
            </div>
            <div className="space-y-2"><Label>Observação</Label><Input value={formReceber.observacao} onChange={(e) => setFormReceber({ ...formReceber, observacao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogReceber(false)}>Cancelar</Button>
            <Button onClick={saveReceber} disabled={loadingReceber || !formReceber.descricao || !formReceber.valor || !formReceber.data_vencimento}>{loadingReceber ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financeiro;
