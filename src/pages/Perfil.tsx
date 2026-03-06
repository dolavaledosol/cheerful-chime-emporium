import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MapPin, Phone, User, Package, Loader2, MessageCircle, Eye, Shield, ChevronRight } from "lucide-react";
import { formatTelefone, unformatTelefone } from "@/lib/telefone";
import { formatCpfCnpj } from "@/lib/cpfCnpj";
import { Skeleton } from "@/components/ui/skeleton";
import { useCep } from "@/hooks/useCep";
import { Switch } from "@/components/ui/switch";
import AppHeader from "@/components/shared/AppHeader";

interface Cliente {
  cliente_id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
}

interface Endereco {
  endereco_id: string;
  cep: string | null;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  observacao: string | null;
}

interface Telefone {
  cliente_telefone_id: string;
  telefone: string;
  is_whatsapp: boolean;
}

interface Pedido {
  pedido_id: string;
  data: string;
  total: number;
  frete: number;
  status: string;
  origem: string;
  observacao: string | null;
}

interface PedidoItem {
  pedido_item_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  produto_nome: string;
}

const emptyEndereco = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", observacao: "" };

const statusConfig: Record<string, { label: string; color: string }> = {
  carrinho: { label: "Carrinho", color: "bg-muted text-muted-foreground" },
  separacao: { label: "Separação", color: "bg-accent text-accent-foreground" },
  aguardando_pagamento: { label: "Aguardando pgto", color: "bg-accent text-accent-foreground" },
  pago: { label: "Pago", color: "bg-primary/10 text-primary" },
  enviado: { label: "Enviado", color: "bg-primary/10 text-primary" },
  entregue: { label: "Entregue", color: "bg-primary/15 text-primary" },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
};

const Perfil = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [telefones, setTelefones] = useState<Telefone[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [editNome, setEditNome] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [saving, setSaving] = useState(false);

  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [editEndId, setEditEndId] = useState<string | null>(null);
  const [endForm, setEndForm] = useState(emptyEndereco);
  const { fetchCep, loading: cepLoading } = useCep();

  const [telDialogOpen, setTelDialogOpen] = useState(false);
  const [editTelId, setEditTelId] = useState<string | null>(null);
  const [telForm, setTelForm] = useState("");
  const [telWhatsapp, setTelWhatsapp] = useState(true);

  const [pedidoDetailOpen, setPedidoDetailOpen] = useState(false);
  const [pedidoDetail, setPedidoDetail] = useState<Pedido | null>(null);
  const [pedidoItens, setPedidoItens] = useState<PedidoItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [activeTab, setActiveTab] = useState<"dados" | "enderecos" | "pedidos">("dados");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    loadAll();
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => { if (data) setIsAdmin(true); });
  }, [user, authLoading]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: clienteData } = await supabase.from("cliente").select("*").eq("user_id", user.id).maybeSingle();
    if (clienteData) {
      setCliente(clienteData as any);
      setEditNome((clienteData as any).nome);
      setEditCpf((clienteData as any).cpf_cnpj || "");
      const [endRes, telRes, pedRes] = await Promise.all([
        supabase.from("cliente_endereco").select("endereco_id, endereco:endereco_id(*)").eq("cliente_id", (clienteData as any).cliente_id),
        supabase.from("cliente_telefone").select("*").eq("cliente_id", (clienteData as any).cliente_id),
        supabase.from("pedido").select("pedido_id, data, total, frete, status, origem, observacao").eq("cliente_id", (clienteData as any).cliente_id).neq("status", "carrinho").order("data", { ascending: false }),
      ]);
      if (endRes.data) setEnderecos(endRes.data.map((e: any) => e.endereco).filter(Boolean));
      if (telRes.data) setTelefones(telRes.data as any);
      if (pedRes.data) setPedidos(pedRes.data as any);
    }
    setLoading(false);
  };

  const validateCpfDigits = (cpf: string): boolean => {
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    let s = 0; for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
    let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== parseInt(d[9])) return false;
    s = 0; for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
    r = (s * 10) % 11; if (r === 10) r = 0; return r === parseInt(d[10]);
  };

  const validateCnpjDigits = (cnpj: string): boolean => {
    const d = cnpj.replace(/\D/g, "");
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0; for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i];
    let r = s % 11; const d1 = r < 2 ? 0 : 11 - r; if (parseInt(d[12]) !== d1) return false;
    s = 0; for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i];
    r = s % 11; const d2 = r < 2 ? 0 : 11 - r; return parseInt(d[13]) === d2;
  };

  const saveProfile = async () => {
    if (!cliente || !user) return;
    const cpfDigits = editCpf.replace(/\D/g, "");
    if (cpfDigits.length > 0) {
      if (cpfDigits.length <= 11) {
        if (cpfDigits.length !== 11 || !validateCpfDigits(cpfDigits)) { toast({ title: "CPF inválido", variant: "destructive" }); return; }
      } else {
        if (cpfDigits.length !== 14 || !validateCnpjDigits(cpfDigits)) { toast({ title: "CNPJ inválido", variant: "destructive" }); return; }
      }
    }
    setSaving(true);
    try {
      if (cpfDigits.length > 0) {
        const { data: mergedId, error: rpcErr } = await supabase.rpc("find_or_link_cliente_by_cpf", {
          _cpf_cnpj: cpfDigits, _user_id: user.id, _email: user.email ?? "", _nome: editNome,
        });
        if (rpcErr) throw rpcErr;
        await supabase.from("cliente").update({ nome: editNome }).eq("cliente_id", mergedId);
      } else {
        await supabase.from("cliente").update({ nome: editNome, cpf_cnpj: null }).eq("cliente_id", cliente.cliente_id);
      }
      toast({ title: "Perfil atualizado" }); loadAll();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    setSaving(false);
  };

  const openNewEnd = () => { setEditEndId(null); setEndForm(emptyEndereco); setEndDialogOpen(true); };
  const openEditEnd = (e: Endereco) => {
    setEditEndId(e.endereco_id);
    setEndForm({ cep: e.cep || "", logradouro: e.logradouro, numero: e.numero || "", complemento: e.complemento || "", bairro: e.bairro || "", cidade: e.cidade, estado: e.estado, observacao: e.observacao || "" });
    setEndDialogOpen(true);
  };

  const saveEndereco = async () => {
    if (!cliente) return;
    setSaving(true);
    const payload: any = { cep: endForm.cep || null, logradouro: endForm.logradouro, numero: endForm.numero || null, complemento: endForm.complemento || null, bairro: endForm.bairro || null, cidade: endForm.cidade, estado: endForm.estado, observacao: endForm.observacao || null };
    if (editEndId) { await supabase.from("endereco").update(payload).eq("endereco_id", editEndId); }
    else { const { data } = await supabase.from("endereco").insert(payload).select().single(); if (data) { await supabase.from("cliente_endereco").insert({ cliente_id: cliente.cliente_id, endereco_id: (data as any).endereco_id }); } }
    setSaving(false); setEndDialogOpen(false);
    toast({ title: editEndId ? "Endereço atualizado" : "Endereço adicionado" }); loadAll();
  };

  const deleteEndereco = async (id: string) => {
    await supabase.from("cliente_endereco").delete().eq("endereco_id", id);
    await supabase.from("endereco").update({ ativo: false }).eq("endereco_id", id);
    toast({ title: "Endereço removido" }); loadAll();
  };

  const openNewTel = () => { setEditTelId(null); setTelForm(""); setTelWhatsapp(false); setTelDialogOpen(true); };
  const openEditTel = (t: Telefone) => { setEditTelId(t.cliente_telefone_id); setTelForm(formatTelefone(t.telefone)); setTelWhatsapp(t.is_whatsapp); setTelDialogOpen(true); };

  const saveTelefone = async () => {
    if (!cliente) return;
    const digits = unformatTelefone(telForm);
    if (digits.length < 10) { toast({ title: "Telefone inválido", description: "Informe ao menos 10 dígitos", variant: "destructive" }); return; }
    setSaving(true);
    if (editTelId) { await supabase.from("cliente_telefone").update({ telefone: digits, is_whatsapp: false }).eq("cliente_telefone_id", editTelId); }
    else { await supabase.from("cliente_telefone").insert({ cliente_id: cliente.cliente_id, telefone: digits, is_whatsapp: false }); }
    setSaving(false); setTelDialogOpen(false);
    toast({ title: editTelId ? "Telefone atualizado" : "Telefone adicionado" }); loadAll();
  };

  const deleteTelefone = async (id: string) => {
    await supabase.from("cliente_telefone").delete().eq("cliente_telefone_id", id);
    toast({ title: "Telefone removido" }); loadAll();
  };

  const openPedidoDetail = async (p: Pedido) => {
    setPedidoDetail(p); setPedidoItens([]); setPedidoDetailOpen(true); setLoadingDetail(true);
    const { data } = await supabase.from("pedido_item").select("pedido_item_id, produto_id, quantidade, preco_unitario, produto:produto_id(nome)").eq("pedido_id", p.pedido_id);
    if (data) { setPedidoItens(data.map((i: any) => ({ pedido_item_id: i.pedido_item_id, produto_id: i.produto_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario, produto_nome: i.produto?.nome || "Produto removido" }))); }
    setLoadingDetail(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader backTo="/" backLabel="Catálogo" />
        <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "dados" as const, label: "Dados", icon: User },
    { id: "enderecos" as const, label: "Endereços", icon: MapPin },
    { id: "pedidos" as const, label: "Pedidos", icon: Package },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader backTo="/" backLabel="Catálogo">
        {isAdmin && (
          <Button size="sm" variant="ghost" className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-full gap-1.5 text-xs" onClick={() => navigate("/admin")}>
            <Shield className="h-4 w-4" /> Admin
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-full text-xs" onClick={async () => { await signOut(); navigate("/"); }}>
          Sair
        </Button>
      </AppHeader>

      {/* Tab bar - sticky */}
      <div className="sticky top-14 md:top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex max-w-lg mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        {/* DADOS */}
        {activeTab === "dados" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Personal info */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Dados pessoais</h2>
              <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Nome</Label>
                  <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="rounded-xl h-12" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">CPF/CNPJ</Label>
                  <Input value={formatCpfCnpj(editCpf)} onChange={(e) => { if (!cliente?.cpf_cnpj) setEditCpf(e.target.value.replace(/\D/g, "").slice(0, 14)); }} disabled={!!cliente?.cpf_cnpj} className={`rounded-xl h-12 ${cliente?.cpf_cnpj ? "bg-muted" : ""}`} />
                  {cliente?.cpf_cnpj && <p className="text-[11px] text-muted-foreground">Não pode ser alterado após cadastrado</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Email</Label>
                  <Input value={user?.email || ""} disabled className="rounded-xl h-12 bg-muted" />
                </div>
                <Button onClick={saveProfile} disabled={saving} className="w-full rounded-full h-11">
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </section>

            {/* Phones */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Telefones</h2>
                <button onClick={openNewTel} className="text-xs text-primary font-medium flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              {telefones.length === 0 ? (
                <div className="bg-card rounded-xl border border-border/50 p-6 flex flex-col items-center gap-2 text-muted-foreground">
                  <Phone className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm">Nenhum telefone cadastrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {telefones.map((t) => (
                    <div key={t.cliente_telefone_id} className="bg-card rounded-xl border border-border/50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{formatTelefone(t.telefone)}</span>
                          {t.is_whatsapp && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        <button onClick={() => openEditTel(t)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => deleteTelefone(t.cliente_telefone_id)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ENDEREÇOS */}
        {activeTab === "enderecos" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Meus endereços</h2>
              <button onClick={openNewEnd} className="text-xs text-primary font-medium flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Novo
              </button>
            </div>
            {enderecos.length === 0 ? (
              <div className="bg-card rounded-xl border border-border/50 p-6 flex flex-col items-center gap-2 text-muted-foreground">
                <MapPin className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm">Nenhum endereço cadastrado</p>
              </div>
            ) : (
              enderecos.map((e) => (
                <div key={e.endereco_id} className="bg-card rounded-xl border border-border/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{e.logradouro}{e.numero ? `, ${e.numero}` : ""}</p>
                        {e.complemento && <p className="text-xs text-muted-foreground">{e.complemento}</p>}
                        <p className="text-xs text-muted-foreground">{[e.bairro, e.cidade, e.estado].filter(Boolean).join(" — ")}</p>
                        {e.cep && <p className="text-xs text-muted-foreground">CEP: {e.cep}</p>}
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => openEditEnd(e)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button onClick={() => deleteEndereco(e.endereco_id)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PEDIDOS */}
        {activeTab === "pedidos" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Meus pedidos</h2>
            {pedidos.length === 0 ? (
              <div className="bg-card rounded-xl border border-border/50 p-6 flex flex-col items-center gap-2 text-muted-foreground">
                <Package className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm">Nenhum pedido realizado ainda</p>
              </div>
            ) : (
              pedidos.map((p) => {
                const s = statusConfig[p.status] || { label: p.status, color: "bg-muted text-muted-foreground" };
                return (
                  <div
                    key={p.pedido_id}
                    className="bg-card rounded-xl border border-border/50 p-4 cursor-pointer hover:shadow-sm transition-shadow active:scale-[0.99]"
                    onClick={() => openPedidoDetail(p)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground"># {p.pedido_id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{new Date(p.data).toLocaleDateString("pt-BR")}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm">R$ {Number(p.total).toFixed(2)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Endereco Dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto mx-4 rounded-2xl">
          <DialogHeader><DialogTitle>{editEndId ? "Editar Endereço" : "Novo Endereço"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <Label className="text-xs">CEP</Label>
                <div className="relative">
                  <Input value={endForm.cep} onChange={(e) => setEndForm({ ...endForm, cep: e.target.value })} onBlur={async () => { const data = await fetchCep(endForm.cep); if (data) { setEndForm((prev) => ({ ...prev, logradouro: data.street || prev.logradouro, bairro: data.neighborhood || prev.bairro, cidade: data.city || prev.cidade, estado: data.state || prev.estado })); } }} placeholder="00000-000" maxLength={9} className="rounded-xl" />
                  {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Logradouro *</Label><Input value={endForm.logradouro} onChange={(e) => setEndForm({ ...endForm, logradouro: e.target.value })} className="rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Número</Label><Input value={endForm.numero} onChange={(e) => setEndForm({ ...endForm, numero: e.target.value })} className="rounded-xl" /></div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Complemento</Label><Input value={endForm.complemento} onChange={(e) => setEndForm({ ...endForm, complemento: e.target.value })} className="rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Bairro</Label><Input value={endForm.bairro} onChange={(e) => setEndForm({ ...endForm, bairro: e.target.value })} className="rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-xs">Cidade *</Label><Input value={endForm.cidade} onChange={(e) => setEndForm({ ...endForm, cidade: e.target.value })} className="rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-xs">Estado *</Label><Input value={endForm.estado} onChange={(e) => setEndForm({ ...endForm, estado: e.target.value })} maxLength={2} className="rounded-xl" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Observação</Label><Input value={endForm.observacao} onChange={(e) => setEndForm({ ...endForm, observacao: e.target.value })} className="rounded-xl" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEndDialogOpen(false)} className="rounded-full">Cancelar</Button>
            <Button onClick={saveEndereco} disabled={saving || !endForm.logradouro || !endForm.cidade || !endForm.estado} className="rounded-full">{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Telefone Dialog */}
      <Dialog open={telDialogOpen} onOpenChange={setTelDialogOpen}>
        <DialogContent className="mx-4 rounded-2xl">
          <DialogHeader><DialogTitle>{editTelId ? "Editar Telefone" : "Novo Telefone"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Telefone</Label>
              <Input placeholder="(00) 00000-0000" value={telForm} onChange={(e) => setTelForm(formatTelefone(e.target.value))} className="rounded-xl h-12" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={telWhatsapp} onCheckedChange={setTelWhatsapp} />
              <Label className="flex items-center gap-1.5 text-sm"><MessageCircle className="h-4 w-4 text-primary" /> É WhatsApp?</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTelDialogOpen(false)} className="rounded-full">Cancelar</Button>
            <Button onClick={saveTelefone} disabled={saving || !telForm} className="rounded-full">{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pedido Detail Dialog */}
      <Dialog open={pedidoDetailOpen} onOpenChange={setPedidoDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto mx-4 rounded-2xl sm:max-w-lg">
          <DialogHeader><DialogTitle>Detalhes do Pedido</DialogTitle></DialogHeader>
          {pedidoDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Pedido</span>
                  <p className="font-mono text-xs font-medium mt-0.5">{pedidoDetail.pedido_id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Data</span>
                  <p className="text-sm font-medium mt-0.5">{new Date(pedidoDetail.data).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</span>
                  <p className="mt-0.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(statusConfig[pedidoDetail.status] || { color: "bg-muted" }).color}`}>{(statusConfig[pedidoDetail.status] || { label: pedidoDetail.status }).label}</span></p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Origem</span>
                  <p className="text-sm font-medium mt-0.5 capitalize">{pedidoDetail.origem}</p>
                </div>
              </div>

              {pedidoDetail.observacao && (
                <div className="bg-accent/30 rounded-xl p-3">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Observação</span>
                  <p className="text-sm mt-0.5">{pedidoDetail.observacao}</p>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Itens</h4>
                {loadingDetail ? (
                  <div className="space-y-2"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /></div>
                ) : pedidoItens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
                ) : (
                  <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                    {pedidoItens.map((item, idx) => (
                      <div key={item.pedido_item_id} className={`flex justify-between items-center px-4 py-2.5 ${idx > 0 ? "border-t border-border/30" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{item.produto_nome}</p>
                          <p className="text-xs text-muted-foreground">{Number(item.quantidade)}× R$ {Number(item.preco_unitario).toFixed(2)}</p>
                        </div>
                        <span className="text-sm font-medium ml-3">R$ {(Number(item.quantidade) * Number(item.preco_unitario)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-3 space-y-1">
                {pedidoDetail.frete > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Frete:</span><span>R$ {Number(pedidoDetail.frete).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">R$ {Number(pedidoDetail.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Perfil;
