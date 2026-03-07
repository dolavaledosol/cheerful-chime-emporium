import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, ArrowLeft, LogIn, Truck, Store, AlertCircle, Plus, MapPin, Loader2, Phone, Check, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useCep } from "@/hooks/useCep";
import AppHeader from "@/components/shared/AppHeader";
import { formatTelefone as formatTelefoneShared } from "@/lib/telefone";

// interfaces
interface Endereco { endereco_id: string; cep: string | null; logradouro: string; numero: string | null; complemento: string | null; bairro: string | null; cidade: string; estado: string; }

const emptyEndForm = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" };

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(digits[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(digits[13]) === d2;
}

function formatTelefone(value: string) { return formatTelefoneShared(value); }

function validateCpfCnpj(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "CPF ou CNPJ é obrigatório";
  if (digits.length <= 11) { if (digits.length !== 11) return "CPF deve ter 11 dígitos"; if (!validateCpf(digits)) return "CPF inválido"; }
  else { if (digits.length !== 14) return "CNPJ deve ter 14 dígitos"; if (!validateCnpj(digits)) return "CNPJ inválido"; }
  return null;
}

const Checkout = () => {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cpfCnpjLocked, setCpfCnpjLocked] = useState(false);
  const [cpfCnpjError, setCpfCnpjError] = useState<string | null>(null);
  const [tipoEntrega, setTipoEntrega] = useState<"entrega" | "retirada" | "">("");
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState("");
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endForm, setEndForm] = useState(emptyEndForm);
  const [savingEnd, setSavingEnd] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [telefones, setTelefones] = useState<string[]>([""]);
  const [telefoneError, setTelefoneError] = useState<string | null>(null);
  const { fetchCep, loading: cepLoading } = useCep();

  useEffect(() => {
    if (user) {
      supabase.from("cliente").select("cliente_id, cpf_cnpj").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setClienteId(data.cliente_id);
          if (data.cpf_cnpj) { setCpfCnpj(formatCpfCnpj(data.cpf_cnpj)); setCpfCnpjLocked(true); }
          loadEnderecos(data.cliente_id);
          supabase.from("cliente_telefone").select("telefone").eq("cliente_id", data.cliente_id).order("cliente_telefone_id").then(({ data: tels }) => {
            if (tels && tels.length > 0) setTelefones(tels.map(t => formatTelefone(t.telefone)));
          });
        }
      });
    }
  }, [user]);

  const loadEnderecos = async (cId: string) => {
    const { data } = await supabase.from("cliente_endereco").select("endereco_id, endereco:endereco_id(*)").eq("cliente_id", cId);
    if (data) { setEnderecos(data.map((e: any) => e.endereco).filter(Boolean)); }
  };

  // Empty cart
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader backTo="/" backLabel="Catálogo" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">Carrinho vazio</p>
          <Link to="/"><Button variant="outline" className="gap-2 rounded-full"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</Button></Link>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader backTo="/" backLabel="Catálogo" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <LogIn className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-medium">Faça login para continuar</p>
          <p className="text-sm text-muted-foreground text-center">Você precisa de uma conta para finalizar o pedido</p>
          <Link to="/auth?redirect=/checkout"><Button className="gap-2 rounded-full"><LogIn className="h-4 w-4" /> Entrar / Cadastrar</Button></Link>
          <Link to="/"><Button variant="ghost" className="gap-2 text-sm"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</Button></Link>
        </div>
      </div>
    );
  }

  const handleCpfCnpjChange = (value: string) => { if (cpfCnpjLocked) return; const digits = value.replace(/\D/g, "").slice(0, 14); setCpfCnpj(formatCpfCnpj(digits)); if (cpfCnpjError) setCpfCnpjError(null); };
  const handleCpfCnpjBlur = () => { if (cpfCnpj.replace(/\D/g, "").length > 0) { const err = validateCpfCnpj(cpfCnpj); if (err) setCpfCnpjError(err); } };
  const handleTelefoneChange = (idx: number, value: string) => { const digits = value.replace(/\D/g, "").slice(0, 11); const updated = [...telefones]; updated[idx] = formatTelefone(digits); setTelefones(updated); if (telefoneError) setTelefoneError(null); };

  const handleCepBlur = async () => {
    const cep = endForm.cep.replace(/\D/g, "");
    if (cep.length === 8) {
      const result = await fetchCep(cep);
      if (result) { setEndForm((prev) => ({ ...prev, logradouro: result.street || prev.logradouro, bairro: result.neighborhood || prev.bairro, cidade: result.city || prev.cidade, estado: result.state || prev.estado })); }
    }
  };

  const findOrCreateCliente = async (): Promise<string> => {
    const cleanCpf = cpfCnpj.replace(/\D/g, "");
    const { data, error } = await supabase.rpc("find_or_link_cliente_by_cpf", {
      _cpf_cnpj: cleanCpf,
      _user_id: user.id,
      _email: user.email ?? null,
      _nome: user.email ?? "Cliente",
    });
    if (error) throw error;
    const cId = data as string;
    setClienteId(cId);
    return cId;
  };

  const saveNovoEndereco = async () => {
    if (!endForm.logradouro || !endForm.cidade || !endForm.estado) { toast({ title: "Preencha logradouro, cidade e estado", variant: "destructive" }); return; }
    setSavingEnd(true);
    try {
      const cId = await findOrCreateCliente();
      const { data: endData, error: eErr } = await supabase.from("endereco").insert({ cep: endForm.cep || null, logradouro: endForm.logradouro, numero: endForm.numero || null, complemento: endForm.complemento || null, bairro: endForm.bairro || null, cidade: endForm.cidade, estado: endForm.estado }).select().single();
      if (eErr) throw eErr;
      await supabase.from("cliente_endereco").insert({ cliente_id: cId!, endereco_id: (endData as any).endereco_id });
      setEndDialogOpen(false); setEndForm(emptyEndForm); toast({ title: "Endereço adicionado" });
      await loadEnderecos(cId!); setEnderecoSelecionado((endData as any).endereco_id);
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    finally { setSavingEnd(false); }
  };

  const handleFinalize = async () => {
    const error = validateCpfCnpj(cpfCnpj);
    if (error) { setCpfCnpjError(error); return; }
    const firstTelDigits = telefones[0]?.replace(/\D/g, "") || "";
    if (firstTelDigits.length < 10) { setTelefoneError("Telefone deve ter pelo menos 10 dígitos"); return; }
    if (!tipoEntrega) { toast({ title: "Selecione o tipo de entrega", variant: "destructive" }); return; }
    if (tipoEntrega === "entrega" && !enderecoSelecionado) { toast({ title: "Selecione ou cadastre um endereço de entrega", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const cId = await findOrCreateCliente();
      await loadEnderecos(cId);

      // Save all phones
      const validPhones = telefones.map(t => t.replace(/\D/g, "")).filter(t => t.length >= 10);
      // Delete existing phones for this client
      const { data: existingTels } = await supabase.from("cliente_telefone").select("cliente_telefone_id").eq("cliente_id", cId!);
      if (existingTels) {
        for (const et of existingTels) await supabase.from("cliente_telefone").delete().eq("cliente_telefone_id", et.cliente_telefone_id);
      }
      for (const phone of validPhones) {
        await supabase.from("cliente_telefone").insert({ cliente_id: cId!, telefone: phone, is_whatsapp: false });
      }

      let observacao = "";
      if (tipoEntrega === "entrega") {
        const end = enderecos.find((e) => e.endereco_id === enderecoSelecionado);
        const endStr = end ? `${end.logradouro}${end.numero ? `, ${end.numero}` : ""} — ${end.cidade}/${end.estado}` : "";
        observacao = `Entrega — frete sem compromisso, será calculado e informado posteriormente. Endereço: ${endStr}`;
      } else { observacao = `Retirada — local será definido na separação`; }

      const { data: pedido, error: pErr } = await supabase.from("pedido").insert({ cliente_id: cId!, data: new Date().toISOString(), total, status: "separacao", origem: "web", local_estoque_id: null, observacao }).select("pedido_id").single();
      if (pErr) throw pErr;

      const pedidoItems = items.map((item) => ({ pedido_id: pedido!.pedido_id, produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario: item.preco }));
      const { error: iErr } = await supabase.from("pedido_item").insert(pedidoItems);
      if (iErr) throw iErr;

      await supabase.from("pedido_status_historico").insert({ pedido_id: pedido!.pedido_id, status: "separacao", usuario_id: user.id });
      clearCart();
      toast({ title: "Pedido criado com sucesso!", description: "Acompanhe o status no seu perfil." });
      navigate("/perfil");
    } catch (err: any) { toast({ title: "Erro ao criar pedido", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const cpfCnpjDigits = cpfCnpj.replace(/\D/g, "");
  const isCpfCnpjValid = (cpfCnpjDigits.length === 11 && validateCpf(cpfCnpjDigits)) || (cpfCnpjDigits.length === 14 && validateCnpj(cpfCnpjDigits));
  const canSubmit = !loading && isCpfCnpjValid && !cpfCnpjError && (telefones[0]?.replace(/\D/g, "").length ?? 0) >= 10 && !telefoneError && tipoEntrega !== "" && (tipoEntrega === "retirada" || enderecoSelecionado !== "");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader backTo="/" backLabel="Catálogo" />

      <main className="flex-1 px-4 py-5 md:py-8 max-w-lg mx-auto w-full">
        <h1 className="text-xl font-bold mb-5">Finalizar Pedido</h1>

        {/* Order summary */}
        <section className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Resumo</h2>
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <div className="divide-y divide-border/50">
              {items.map((item) => (
                <div key={item.produto_id} className="flex justify-between items-center px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">{item.quantidade}× R$ {item.preco.toFixed(2)}</p>
                  </div>
                  <span className="font-semibold text-sm ml-3">R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-muted/30 px-4 py-3 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Identification */}
        <section className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Identificação</h2>
          <div className="bg-card rounded-xl border border-border/50 p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cpfcnpj" className="text-sm">CPF ou CNPJ *</Label>
              <Input
                id="cpfcnpj"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => handleCpfCnpjChange(e.target.value)}
                onBlur={handleCpfCnpjBlur}
                disabled={cpfCnpjLocked}
                className={`rounded-xl h-12 ${cpfCnpjError ? "border-destructive" : ""} ${cpfCnpjLocked ? "bg-muted" : ""}`}
              />
              {cpfCnpjLocked && <p className="text-[11px] text-muted-foreground">Não pode ser alterado após cadastrado</p>}
              {cpfCnpjError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {cpfCnpjError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefones *
                </Label>
                <button type="button" onClick={() => setTelefones([...telefones, ""])} className="text-xs text-primary font-medium flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {telefones.map((tel, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder="+55 (31) 90000-0000"
                    value={tel}
                    onChange={(e) => handleTelefoneChange(idx, e.target.value)}
                    className={`rounded-xl h-12 ${telefoneError && idx === 0 ? "border-destructive" : ""}`}
                  />
                  {telefones.length > 1 && (
                    <button type="button" onClick={() => setTelefones(telefones.filter((_, i) => i !== idx))} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-destructive/10 transition-colors shrink-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
              {telefoneError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> {telefoneError}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Delivery type */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Entrega</h2>
          <div className="space-y-3">
            <RadioGroup value={tipoEntrega} onValueChange={(v) => setTipoEntrega(v as "entrega" | "retirada")}>
              {/* Entrega */}
              <div
                className={`bg-card rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  tipoEntrega === "entrega" ? "border-primary shadow-sm" : "border-border/50 hover:border-border"
                }`}
                onClick={() => setTipoEntrega("entrega")}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    tipoEntrega === "entrega" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Entrega</p>
                    <p className="text-xs text-muted-foreground">Receba no seu endereço</p>
                  </div>
                  <RadioGroupItem value="entrega" id="entrega" />
                </div>
              </div>

              {/* Retirada */}
              <div
                className={`bg-card rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  tipoEntrega === "retirada" ? "border-primary shadow-sm" : "border-border/50 hover:border-border"
                }`}
                onClick={() => setTipoEntrega("retirada")}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    tipoEntrega === "retirada" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Retirada no local</p>
                    <p className="text-xs text-muted-foreground">Retire em uma de nossas unidades</p>
                  </div>
                  <RadioGroupItem value="retirada" id="retirada" />
                </div>
              </div>
            </RadioGroup>

            {/* Delivery address */}
            {tipoEntrega === "entrega" && (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="rounded-xl bg-accent/50 border border-accent p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">O frete será calculado e informado posteriormente pela equipe, <strong>sem compromisso</strong>.</p>
                </div>

                <div className="space-y-2">
                  {enderecos.length > 0 && enderecos.map((e) => (
                    <div
                      key={e.endereco_id}
                      className={`bg-card rounded-xl border-2 p-3 cursor-pointer transition-all ${
                        enderecoSelecionado === e.endereco_id ? "border-primary shadow-sm" : "border-border/50 hover:border-border"
                      }`}
                      onClick={() => setEnderecoSelecionado(e.endereco_id)}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          enderecoSelecionado === e.endereco_id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {enderecoSelecionado === e.endereco_id ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{e.logradouro}{e.numero ? `, ${e.numero}` : ""}</p>
                          {e.complemento && <p className="text-xs text-muted-foreground">{e.complemento}</p>}
                          <p className="text-xs text-muted-foreground">{[e.bairro, e.cidade, e.estado].filter(Boolean).join(" — ")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {enderecos.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado</p>
                  )}
                  <button
                    onClick={() => { setEndForm(emptyEndForm); setEndDialogOpen(true); }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Cadastrar novo endereço
                  </button>
                </div>
              </div>
            )}

            {tipoEntrega === "retirada" && (
              <div className="rounded-xl bg-accent/50 border border-accent p-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
                <Store className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">O local de retirada será definido pela equipe durante a separação.</p>
              </div>
            )}
          </div>
        </section>

        {/* Submit */}
        <div className="safe-bottom pb-4">
          <Button
            className="w-full h-14 rounded-full text-base font-semibold"
            onClick={handleFinalize}
            disabled={!canSubmit}
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processando...</>
            ) : (
              "Confirmar Pedido"
            )}
          </Button>
        </div>
      </main>

      {/* Address dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto mx-4 rounded-2xl">
          <DialogHeader><DialogTitle>Novo Endereço</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <Label className="text-xs">CEP</Label>
                <div className="relative">
                  <Input value={endForm.cep} onChange={(e) => setEndForm({ ...endForm, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" className="rounded-xl" />
                  {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Logradouro *</Label><Input value={endForm.logradouro} onChange={(e) => setEndForm({ ...endForm, logradouro: e.target.value })} className="rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Número</Label><Input value={endForm.numero} onChange={(e) => setEndForm({ ...endForm, numero: e.target.value })} className="rounded-xl" /></div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Complemento</Label><Input value={endForm.complemento} onChange={(e) => setEndForm({ ...endForm, complemento: e.target.value })} className="rounded-xl" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Bairro</Label><Input value={endForm.bairro} onChange={(e) => setEndForm({ ...endForm, bairro: e.target.value })} className="rounded-xl" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2"><Label className="text-xs">Cidade *</Label><Input value={endForm.cidade} onChange={(e) => setEndForm({ ...endForm, cidade: e.target.value })} className="rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-xs">Estado *</Label><Input value={endForm.estado} onChange={(e) => setEndForm({ ...endForm, estado: e.target.value })} maxLength={2} className="rounded-xl" /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEndDialogOpen(false)} className="rounded-full">Cancelar</Button>
            <Button onClick={saveNovoEndereco} disabled={savingEnd} className="rounded-full">{savingEnd ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Checkout;
