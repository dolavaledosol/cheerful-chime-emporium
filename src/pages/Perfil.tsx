import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MapPin, Phone, User, Package, Loader2, MessageCircle, Eye, Shield } from "lucide-react";
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

const statusLabel: Record<string, { label: string; color: string }> = {
  carrinho: { label: "Carrinho", color: "bg-muted text-muted-foreground" },
  separacao: { label: "Separação", color: "bg-yellow-100 text-yellow-800" },
  aguardando_pagamento: { label: "Aguardando pgto", color: "bg-orange-100 text-orange-800" },
  pago: { label: "Pago", color: "bg-blue-100 text-blue-800" },
  enviado: { label: "Enviado", color: "bg-indigo-100 text-indigo-800" },
  entregue: { label: "Entregue", color: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
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
    } else {
      const { data: newCliente } = await supabase.from("cliente").insert({ user_id: user.id, nome: user.user_metadata?.full_name || user.email || "", email: user.email }).select().single();
      if (newCliente) { setCliente(newCliente as any); setEditNome((newCliente as any).nome); }
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
    if (!cliente) return;
    const cpfDigits = editCpf.replace(/\D/g, "");
    if (cpfDigits.length > 0) {
      if (cpfDigits.length <= 11) {
        if (cpfDigits.length !== 11 || !validateCpfDigits(cpfDigits)) { toast({ title: "CPF inválido", variant: "destructive" }); return; }
      } else {
        if (cpfDigits.length !== 14 || !validateCnpjDigits(cpfDigits)) { toast({ title: "CNPJ inválido", variant: "destructive" }); return; }
      }
    }
    setSaving(true);
    const { error } = await supabase.from("cliente").update({ nome: editNome, cpf_cnpj: cpfDigits || null }).eq("cliente_id", cliente.cliente_id);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Perfil atualizado" }); loadAll(); }
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

  const openNewTel = () => { setEditTelId(null); setTelForm(""); setTelWhatsapp(true); setTelDialogOpen(true); };
  const openEditTel = (t: Telefone) => { setEditTelId(t.cliente_telefone_id); setTelForm(t.telefone); setTelWhatsapp(t.is_whatsapp); setTelDialogOpen(true); };

  const saveTelefone = async () => {
    if (!cliente) return;
    setSaving(true);
    if (editTelId) { await supabase.from("cliente_telefone").update({ telefone: telForm, is_whatsapp: telWhatsapp }).eq("cliente_telefone_id", editTelId); }
    else { await supabase.from("cliente_telefone").insert({ cliente_id: cliente.cliente_id, telefone: telForm, is_whatsapp: telWhatsapp }); }
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
        <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader backTo="/" backLabel="Catálogo">
        {isAdmin && (
          <Button size="sm" variant="secondary" className="gap-1.5 bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80" onClick={() => navigate("/admin")}>
            <Shield className="h-4 w-4" /> Admin
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={async () => { await signOut(); navigate("/"); }}>
          Sair
        </Button>
      </AppHeader>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-xl font-bold mb-4">Meu Perfil</h1>
        <Tabs defaultValue="dados" className="space-y-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="dados" className="gap-1.5"><User className="h-3.5 w-3.5 hidden sm:block" /> Dados</TabsTrigger>
            <TabsTrigger value="enderecos" className="gap-1.5"><MapPin className="h-3.5 w-3.5 hidden sm:block" /> Endereços</TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-1.5"><Package className="h-3.5 w-3.5 hidden sm:block" /> Pedidos</TabsTrigger>
          </TabsList>

          {/* DADOS */}
          <TabsContent value="dados">
            <Card>
              <CardHeader><CardTitle className="text-lg">Dados pessoais</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={editNome} onChange={(e) => setEditNome(e.target.value)} /></div>
                <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={user?.email || ""} disabled className="bg-muted" /></div>
                <Button onClick={saveProfile} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Telefones</CardTitle>
                <Button size="sm" variant="outline" onClick={openNewTel} className="gap-1"><Plus className="h-3 w-3" /> Adicionar</Button>
              </CardHeader>
              <CardContent>
                {telefones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum telefone cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {telefones.map((t) => (
                      <div key={t.cliente_telefone_id} className="flex items-center justify-between border rounded-md px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{t.telefone}</span>
                          {t.is_whatsapp && (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              <MessageCircle className="h-3 w-3" /> WhatsApp
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTel(t)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTelefone(t.cliente_telefone_id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENDEREÇOS */}
          <TabsContent value="enderecos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Meus endereços</CardTitle>
                <Button size="sm" onClick={openNewEnd} className="gap-1"><Plus className="h-3 w-3" /> Novo</Button>
              </CardHeader>
              <CardContent>
                {enderecos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado</p>
                ) : (
                  <div className="space-y-3">
                    {enderecos.map((e) => (
                      <div key={e.endereco_id} className="border rounded-lg p-4 space-y-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{e.logradouro}{e.numero ? `, ${e.numero}` : ""}</p>
                            {e.complemento && <p className="text-xs text-muted-foreground">{e.complemento}</p>}
                            <p className="text-xs text-muted-foreground">{[e.bairro, e.cidade, e.estado].filter(Boolean).join(" — ")}</p>
                            {e.cep && <p className="text-xs text-muted-foreground">CEP: {e.cep}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEnd(e)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEndereco(e.endereco_id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PEDIDOS */}
          <TabsContent value="pedidos">
            <Card>
              <CardHeader><CardTitle className="text-lg">Meus pedidos</CardTitle></CardHeader>
              <CardContent>
                {pedidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pedido realizado ainda</p>
                ) : (
                  <div className="space-y-3 md:space-y-0">
                    {/* Mobile: cards */}
                    <div className="md:hidden space-y-3">
                      {pedidos.map((p) => {
                        const s = statusLabel[p.status] || { label: p.status, color: "bg-muted" };
                        return (
                          <div key={p.pedido_id} className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openPedidoDetail(p)}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-muted-foreground">{p.pedido_id.slice(0, 8)}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span>{new Date(p.data).toLocaleDateString("pt-BR")}</span>
                              <span className="font-semibold">R$ {Number(p.total).toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden md:block border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pedidos.map((p) => {
                            const s = statusLabel[p.status] || { label: p.status, color: "bg-muted" };
                            return (
                              <TableRow key={p.pedido_id} className="cursor-pointer" onClick={() => openPedidoDetail(p)}>
                                <TableCell className="text-xs font-mono text-muted-foreground">{p.pedido_id.slice(0, 8)}</TableCell>
                                <TableCell className="text-sm">{new Date(p.data).toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span></TableCell>
                                <TableCell className="text-right font-medium">R$ {Number(p.total).toFixed(2)}</TableCell>
                                <TableCell><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4" /></Button></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Endereco Dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editEndId ? "Editar Endereço" : "Novo Endereço"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <Label className="text-xs">CEP</Label>
                <div className="relative">
                  <Input value={endForm.cep} onChange={(e) => setEndForm({ ...endForm, cep: e.target.value })} onBlur={async () => { const data = await fetchCep(endForm.cep); if (data) { setEndForm((prev) => ({ ...prev, logradouro: data.street || prev.logradouro, bairro: data.neighborhood || prev.bairro, cidade: data.city || prev.cidade, estado: data.state || prev.estado })); } }} placeholder="00000-000" maxLength={9} />
                  {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Logradouro *</Label>
                <Input value={endForm.logradouro} onChange={(e) => setEndForm({ ...endForm, logradouro: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Número</Label><Input value={endForm.numero} onChange={(e) => setEndForm({ ...endForm, numero: e.target.value })} /></div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Complemento</Label><Input value={endForm.complemento} onChange={(e) => setEndForm({ ...endForm, complemento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Bairro</Label><Input value={endForm.bairro} onChange={(e) => setEndForm({ ...endForm, bairro: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Cidade *</Label><Input value={endForm.cidade} onChange={(e) => setEndForm({ ...endForm, cidade: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Estado *</Label><Input value={endForm.estado} onChange={(e) => setEndForm({ ...endForm, estado: e.target.value })} maxLength={2} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Observação</Label><Input value={endForm.observacao} onChange={(e) => setEndForm({ ...endForm, observacao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEndereco} disabled={saving || !endForm.logradouro || !endForm.cidade || !endForm.estado}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Telefone Dialog */}
      <Dialog open={telDialogOpen} onOpenChange={setTelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTelId ? "Editar Telefone" : "Novo Telefone"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Telefone</Label><Input placeholder="(00) 00000-0000" value={telForm} onChange={(e) => setTelForm(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={telWhatsapp} onCheckedChange={setTelWhatsapp} />
              <Label className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-green-600" /> É WhatsApp?</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTelDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveTelefone} disabled={saving || !telForm}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pedido Detail Dialog */}
      <Dialog open={pedidoDetailOpen} onOpenChange={setPedidoDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Detalhes do Pedido</DialogTitle></DialogHeader>
          {pedidoDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Pedido:</span><p className="font-mono text-xs">{pedidoDetail.pedido_id.slice(0, 8)}</p></div>
                <div><span className="text-muted-foreground">Data:</span><p>{new Date(pedidoDetail.data).toLocaleDateString("pt-BR")}</p></div>
                <div><span className="text-muted-foreground">Status:</span><p><span className={`text-xs px-2 py-0.5 rounded-full ${(statusLabel[pedidoDetail.status] || { color: "bg-muted" }).color}`}>{(statusLabel[pedidoDetail.status] || { label: pedidoDetail.status }).label}</span></p></div>
                <div><span className="text-muted-foreground">Origem:</span><p className="capitalize">{pedidoDetail.origem}</p></div>
              </div>
              {pedidoDetail.observacao && (<div className="text-sm"><span className="text-muted-foreground">Observação:</span><p>{pedidoDetail.observacao}</p></div>)}
              <div>
                <h4 className="text-sm font-medium mb-2">Itens</h4>
                {loadingDetail ? (<div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>) : pedidoItens.length === 0 ? (<p className="text-sm text-muted-foreground">Nenhum item encontrado</p>) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Unit.</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {pedidoItens.map((item) => (
                          <TableRow key={item.pedido_item_id}>
                            <TableCell className="text-sm">{item.produto_nome}</TableCell>
                            <TableCell className="text-center text-sm">{Number(item.quantidade)}</TableCell>
                            <TableCell className="text-right text-sm">R$ {Number(item.preco_unitario).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">R$ {(Number(item.quantidade) * Number(item.preco_unitario)).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              <div className="border-t pt-3 space-y-1 text-sm">
                {pedidoDetail.frete > 0 && (<div className="flex justify-between"><span className="text-muted-foreground">Frete:</span><span>R$ {Number(pedidoDetail.frete).toFixed(2)}</span></div>)}
                <div className="flex justify-between font-semibold"><span>Total:</span><span>R$ {Number(pedidoDetail.total).toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Perfil;
