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
import { Plus, Search, Pencil, Trash2, Check, Download, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/* ── Shared types ── */
interface Fornecedor { fornecedor_id: string; nome: string; }
interface Cliente { cliente_id: string; nome: string; }
interface Banco { banco_id: string; nome: string; }
interface FormaPagamento { forma_pagamento_id: string; nome: string; }

interface PhoneOption { cliente_telefone_id: string; telefone: string; pn: string | null; lid: string | null; }

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
  created_at: string; cobrar_auto: boolean;
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
  const [sendingWebhook, setSendingWebhook] = useState(false);

  /* Phone selection dialog state */
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneOptions, setPhoneOptions] = useState<{ cliente_id: string; clienteNome: string; phones: PhoneOption[] }[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<Record<string, string>>({});
  const [pendingWebhookData, setPendingWebhookData] = useState<any[] | null>(null);

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

  const toggleCobrarAuto = async (id: string, current: boolean) => {
    const { error } = await supabase.from("contas_receber").update({ cobrar_auto: !current }).eq("contas_receber_id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: !current ? "Cobrança automática ativada" : "Cobrança automática desativada" });
    loadReceber();
  };

  /* ── Helpers ── */
  const fmtDate = (d: string | null) => d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—";
  const fmtMoney = (v: number) => `R$ ${Number(v).toFixed(2)}`;

  /* ── Build export rows (shared between CSV and webhook) ── */
  const buildExportRows = async (items: ContaReceber[], phoneOverrides?: Record<string, string>) => {
    const clienteIds = [...new Set(items.map((c) => c.cliente_id).filter(Boolean))] as string[];
    let allPhones: Record<string, PhoneOption[]> = {};
    let phoneMap: Record<string, { from: string; pn: string; lid: string }> = {};

    if (clienteIds.length > 0) {
      // Fetch preferred phone ids from cliente table
      const { data: clientePrefs } = await supabase
        .from("cliente")
        .select("cliente_id, telefone_preferencial_id")
        .in("cliente_id", clienteIds);
      const prefMap: Record<string, string | null> = {};
      if (clientePrefs) for (const c of clientePrefs) prefMap[c.cliente_id] = (c as any).telefone_preferencial_id;

      const { data: phones } = await supabase
        .from("cliente_telefone")
        .select("cliente_telefone_id, cliente_id, telefone, pn, lid, is_whatsapp, verificado")
        .in("cliente_id", clienteIds)
        .eq("is_whatsapp", true);
      if (phones) {
        for (const p of phones) {
          if (!allPhones[p.cliente_id]) allPhones[p.cliente_id] = [];
          allPhones[p.cliente_id].push({
            cliente_telefone_id: p.cliente_telefone_id,
            telefone: p.telefone,
            pn: p.pn,
            lid: p.lid,
          });
        }
        for (const [cid, plist] of Object.entries(allPhones)) {
          // Priority: override > preferred > first with lid > first
          const overrideId = phoneOverrides?.[cid];
          const prefId = prefMap[cid];
          const chosen = overrideId
            ? plist.find(p => p.cliente_telefone_id === overrideId) || plist[0]
            : prefId
              ? plist.find(p => p.cliente_telefone_id === prefId) || plist.find(p => p.lid) || plist[0]
              : plist.find(p => p.lid) || plist[0];
          phoneMap[cid] = { from: chosen.telefone || "", pn: chosen.pn || "", lid: chosen.lid || "" };
        }
      }
    }

    return { phoneMap, allPhones };
  };

  const exportReceber = async () => {
    const { phoneMap } = await buildExportRows(filteredReceber);

    const headers = ["Código", "Cliente", "Cliente ID", "WhatsApp (from)", "PN", "LID", "Cód. Pedido", "Data Pedido", "Criação", "Vencimento", "Forma", "Banco", "Valor", "Status"];
    const rows = filteredReceber.map((c) => {
      const phone = c.cliente_id ? phoneMap[c.cliente_id] : null;
      const pedido = (c as any).pedido;
      return [
        c.contas_receber_id.slice(0, 8).toUpperCase(),
        c.cliente?.nome || "—",
        c.cliente_id || "—",
        phone?.from || "—",
        phone?.pn || "—",
        phone?.lid || "—",
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

  /* ── Webhook export ── */
  const webhookExport = async () => {
    const autorizadas = filteredReceber.filter(c => c.cobrar_auto && !c.recebido);
    if (autorizadas.length === 0) {
      toast({ title: "Nenhuma conta autorizada para cobrança automática encontrada", variant: "destructive" });
      return;
    }

    const { phoneMap, allPhones } = await buildExportRows(autorizadas);

    // Check if any client has multiple eligible phones (is_whatsapp + verified + lid not empty)
    const clientsWithMultiplePhones: { cliente_id: string; clienteNome: string; phones: PhoneOption[] }[] = [];
    for (const c of autorizadas) {
      if (!c.cliente_id || !allPhones[c.cliente_id]) continue;
      const eligible = allPhones[c.cliente_id].filter(p => p.lid);
      if (eligible.length > 1 && !clientsWithMultiplePhones.find(x => x.cliente_id === c.cliente_id)) {
        clientsWithMultiplePhones.push({
          cliente_id: c.cliente_id,
          clienteNome: c.cliente?.nome || c.cliente_id,
          phones: eligible,
        });
      }
    }

    if (clientsWithMultiplePhones.length > 0) {
      // Need user to pick phones
      setPhoneOptions(clientsWithMultiplePhones);
      const defaults: Record<string, string> = {};
      for (const cp of clientsWithMultiplePhones) {
        defaults[cp.cliente_id] = cp.phones[0].cliente_telefone_id;
      }
      setSelectedPhones(defaults);
      setPendingWebhookData(autorizadas as any);
      setPhoneDialogOpen(true);
      return;
    }

    await sendWebhook(autorizadas, phoneMap);
  };

  const confirmPhoneAndSend = async () => {
    if (!pendingWebhookData) return;

    // Save selected phones as preferred for each client
    for (const [clienteId, phoneId] of Object.entries(selectedPhones)) {
      await supabase.from("cliente").update({ telefone_preferencial_id: phoneId } as any).eq("cliente_id", clienteId);
    }

    const { phoneMap } = await buildExportRows(pendingWebhookData, selectedPhones);
    setPhoneDialogOpen(false);
    await sendWebhook(pendingWebhookData, phoneMap);
    setPendingWebhookData(null);
  };

  const sendWebhook = async (items: ContaReceber[], phoneMap: Record<string, { from: string; pn: string; lid: string }>) => {
    // Get webhook config
    const { data: configs } = await supabase
      .from("configuracao")
      .select("chave, valor")
      .is("user_id", null)
      .in("chave", ["webhook_cobranca_url", "webhook_cobranca_apikey"]);

    const cfgMap: Record<string, string> = {};
    if (configs) for (const c of configs) cfgMap[c.chave] = c.valor || "";

    const webhookUrl = cfgMap["webhook_cobranca_url"];
    if (!webhookUrl) {
      toast({ title: "URL do webhook não configurada", description: "Acesse Configurações para cadastrar a URL do webhook de cobrança.", variant: "destructive" });
      return;
    }

    const payload = items.map((c) => {
      const phone = c.cliente_id ? phoneMap[c.cliente_id] : null;
      const pedido = (c as any).pedido;
      return {
        codigo: c.contas_receber_id.slice(0, 8).toUpperCase(),
        contas_receber_id: c.contas_receber_id,
        cliente: c.cliente?.nome || "",
        cliente_id: c.cliente_id || "",
        whatsapp_from: phone?.from || "",
        pn: phone?.pn || "",
        lid: phone?.lid || "",
        pedido_id: c.pedido_id || "",
        pedido_codigo: c.pedido_id ? c.pedido_id.slice(0, 8).toUpperCase() : "",
        data_pedido: pedido?.data || "",
        created_at: c.created_at,
        data_vencimento: c.data_vencimento,
        forma: c._forma,
        banco: c._banco_pag,
        valor: Number(c.valor),
        status: c.recebido ? "Recebido" : "Pendente",
      };
    });

    setSendingWebhook(true);
    try {
      const apikey = cfgMap["webhook_cobranca_apikey"];
      const { data, error } = await supabase.functions.invoke("webhook-proxy", {
        body: { webhook_url: webhookUrl, webhook_apikey: apikey || "", payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Webhook enviado com ${items.length} cobranças` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar webhook", description: err.message, variant: "destructive" });
    } finally {
      setSendingWebhook(false);
    }
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
              <Button variant="outline" onClick={webhookExport} disabled={sendingWebhook} className="gap-2">
                {sendingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Cobrar
              </Button>
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
                   <TableHead className="w-20 text-center" title="Cobrança automática">Auto</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceber.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
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
                    <TableCell className="text-center">
                      <Switch
                        checked={c.cobrar_auto}
                        onCheckedChange={() => toggleCobrarAuto(c.contas_receber_id, c.cobrar_auto)}
                        disabled={c.recebido}
                      />
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

      {/* ══════════ DIALOG SELEÇÃO DE TELEFONE ══════════ */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Selecionar telefone para cobrança</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">Os clientes abaixo possuem mais de um telefone WhatsApp com LID. Selecione qual utilizar:</p>
            {phoneOptions.map((opt) => (
              <div key={opt.cliente_id} className="space-y-2 border rounded-lg p-3">
                <Label className="font-semibold">{opt.clienteNome}</Label>
                <RadioGroup
                  value={selectedPhones[opt.cliente_id] || ""}
                  onValueChange={(v) => setSelectedPhones(prev => ({ ...prev, [opt.cliente_id]: v }))}
                >
                  {opt.phones.map((p) => (
                    <div key={p.cliente_telefone_id} className="flex items-center gap-2">
                      <RadioGroupItem value={p.cliente_telefone_id} id={p.cliente_telefone_id} />
                      <Label htmlFor={p.cliente_telefone_id} className="font-normal text-sm cursor-pointer">
                        {p.telefone} {p.lid ? `(LID: ${p.lid})` : ""} {p.pn ? `(PN: ${p.pn})` : ""}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPhoneAndSend} disabled={sendingWebhook}>
              {sendingWebhook ? "Enviando..." : "Confirmar e Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financeiro;
