import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, ArrowLeft, LogIn, Truck, Store, AlertCircle, Plus, MapPin, Loader2, Phone } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useCep } from "@/hooks/useCep";
import AppHeader from "@/components/shared/AppHeader";

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

function formatTelefone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

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
  const [cpfCnpjError, setCpfCnpjError] = useState<string | null>(null);
  const [tipoEntrega, setTipoEntrega] = useState<"entrega" | "retirada" | "">("");
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState("");
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endForm, setEndForm] = useState(emptyEndForm);
  const [savingEnd, setSavingEnd] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [telefone, setTelefone] = useState("");
  const [telefoneError, setTelefoneError] = useState<string | null>(null);
  const { fetchCep, loading: cepLoading } = useCep();

  useEffect(() => {
    // load client data only
    if (user) {
      supabase.from("cliente").select("cliente_id, cpf_cnpj").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setClienteId(data.cliente_id);
          if (data.cpf_cnpj) setCpfCnpj(formatCpfCnpj(data.cpf_cnpj));
          loadEnderecos(data.cliente_id);
          // Load existing phone
          supabase.from("cliente_telefone").select("telefone").eq("cliente_id", data.cliente_id).limit(1).then(({ data: tels }) => {
            if (tels && tels.length > 0) setTelefone(formatTelefone(tels[0].telefone));
          });
        }
      });
    }
  }, [user]);

  const loadEnderecos = async (cId: string) => {
    const { data } = await supabase.from("cliente_endereco").select("endereco_id, endereco:endereco_id(*)").eq("cliente_id", cId);
    if (data) { setEnderecos(data.map((e: any) => e.endereco).filter(Boolean)); }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader backTo="/" backLabel="Catálogo" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground stroke-1" />
          <p className="text-lg text-muted-foreground">Seu carrinho está vazio</p>
          <Link to="/"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</Button></Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader backTo="/" backLabel="Catálogo" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <LogIn className="h-16 w-16 text-muted-foreground stroke-1" />
          <p className="text-lg text-muted-foreground">Faça login para finalizar o pedido</p>
          <Link to="/auth?redirect=/checkout"><Button className="gap-2"><LogIn className="h-4 w-4" /> Entrar / Cadastrar</Button></Link>
          <Link to="/"><Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</Button></Link>
        </div>
      </div>
    );
  }

  const handleCpfCnpjChange = (value: string) => { const digits = value.replace(/\D/g, "").slice(0, 14); setCpfCnpj(formatCpfCnpj(digits)); if (cpfCnpjError) setCpfCnpjError(null); };
  const handleCpfCnpjBlur = () => { if (cpfCnpj.replace(/\D/g, "").length > 0) { const err = validateCpfCnpj(cpfCnpj); if (err) setCpfCnpjError(err); } };
  const handleTelefoneChange = (value: string) => { const digits = value.replace(/\D/g, "").slice(0, 11); setTelefone(formatTelefone(digits)); if (telefoneError) setTelefoneError(null); };

  const handleCepBlur = async () => {
    const cep = endForm.cep.replace(/\D/g, "");
    if (cep.length === 8) {
      const result = await fetchCep(cep);
      if (result) { setEndForm((prev) => ({ ...prev, logradouro: result.street || prev.logradouro, bairro: result.neighborhood || prev.bairro, cidade: result.city || prev.cidade, estado: result.state || prev.estado })); }
    }
  };

  const findOrCreateCliente = async (): Promise<string> => {
    const cleanCpf = cpfCnpj.replace(/\D/g, "");
    // Always use RPC to ensure proper merging/linking
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
    const telDigits = telefone.replace(/\D/g, "");
    if (telDigits.length < 10) { setTelefoneError("Telefone deve ter pelo menos 10 dígitos"); return; }
    if (!tipoEntrega) { toast({ title: "Selecione o tipo de entrega", variant: "destructive" }); return; }
    if (tipoEntrega === "entrega" && !enderecoSelecionado) { toast({ title: "Selecione ou cadastre um endereço de entrega", variant: "destructive" }); return; }

    setLoading(true);
    try {
      
      const cId = await findOrCreateCliente();
      await loadEnderecos(cId);

      // Save/update phone
      const { data: existingTel } = await supabase.from("cliente_telefone").select("cliente_telefone_id").eq("cliente_id", cId!).limit(1);
      if (existingTel && existingTel.length > 0) {
        await supabase.from("cliente_telefone").update({ telefone: telDigits }).eq("cliente_telefone_id", existingTel[0].cliente_telefone_id);
      } else {
        await supabase.from("cliente_telefone").insert({ cliente_id: cId!, telefone: telDigits, is_whatsapp: false });
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
  const canSubmit = !loading && isCpfCnpjValid && !cpfCnpjError && telefone.replace(/\D/g, "").length >= 10 && !telefoneError && tipoEntrega !== "" && (tipoEntrega === "retirada" || enderecoSelecionado !== "");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader backTo="/" backLabel="Catálogo" />

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-xl font-bold mb-6">Finalizar Pedido</h1>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Itens do pedido</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div key={item.produto_id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{item.nome}</p>
                  <p className="text-xs text-muted-foreground">{item.quantidade}x R$ {item.preco.toFixed(2)}</p>
                </div>
                <span className="font-semibold text-sm">R$ {(item.preco * item.quantidade).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Total</span><span>R$ {total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* CPF/CNPJ */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">CPF ou CNPJ</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="cpfcnpj">Informe seu CPF ou CNPJ</Label>
              <Input id="cpfcnpj" placeholder="000.000.000-00 ou 00.000.000/0000-00" value={cpfCnpj} onChange={(e) => handleCpfCnpjChange(e.target.value)} onBlur={handleCpfCnpjBlur} className={cpfCnpjError ? "border-destructive" : ""} />
              {cpfCnpjError && (<p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {cpfCnpjError}</p>)}
            </div>
          </CardContent>
        </Card>

        {/* Telefone */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Phone className="h-5 w-5" /> Telefone</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone para contato *</Label>
              <Input id="telefone" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => handleTelefoneChange(e.target.value)} className={telefoneError ? "border-destructive" : ""} />
              {telefoneError && (<p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {telefoneError}</p>)}
            </div>
          </CardContent>
        </Card>

        {/* Tipo de entrega */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Entrega ou Retirada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={tipoEntrega} onValueChange={(v) => setTipoEntrega(v as "entrega" | "retirada")}>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => setTipoEntrega("entrega")}>
                <RadioGroupItem value="entrega" id="entrega" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="entrega" className="flex items-center gap-2 cursor-pointer font-medium"><Truck className="h-4 w-4" /> Entrega</Label>
                  <p className="text-sm text-muted-foreground mt-1">Receba no seu endereço</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => setTipoEntrega("retirada")}>
                <RadioGroupItem value="retirada" id="retirada" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="retirada" className="flex items-center gap-2 cursor-pointer font-medium"><Store className="h-4 w-4" /> Retirada no local</Label>
                  <p className="text-sm text-muted-foreground mt-1">Retire em uma de nossas unidades</p>
                </div>
              </div>
            </RadioGroup>

            {tipoEntrega === "entrega" && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">O frete será calculado e informado posteriormente pela nossa equipe, <strong>sem compromisso</strong>.</p>
                </div>
                <div className="space-y-2">
                  <Label>Endereço de entrega</Label>
                  {enderecos.length > 0 ? (
                    <div className="space-y-2">
                      {enderecos.map((e) => (
                        <div key={e.endereco_id} className={`border rounded-lg p-3 cursor-pointer transition-colors ${enderecoSelecionado === e.endereco_id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setEnderecoSelecionado(e.endereco_id)}>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{e.logradouro}{e.numero ? `, ${e.numero}` : ""}</p>
                              {e.complemento && <p className="text-xs text-muted-foreground">{e.complemento}</p>}
                              <p className="text-xs text-muted-foreground">{[e.bairro, e.cidade, e.estado].filter(Boolean).join(" — ")}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (<p className="text-sm text-muted-foreground">Nenhum endereço cadastrado</p>)}
                  <Button variant="outline" size="sm" className="gap-1 mt-2" onClick={() => { setEndForm(emptyEndForm); setEndDialogOpen(true); }}><Plus className="h-3 w-3" /> Cadastrar novo endereço</Button>
                </div>
              </div>
            )}

            {tipoEntrega === "retirada" && (
              <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-start gap-2">
                <Store className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">O local de retirada será definido pela nossa equipe durante a separação do pedido.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={handleFinalize} disabled={!canSubmit}>{loading ? "Processando..." : "Confirmar Pedido"}</Button>
      </div>

      {/* New Address Dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Endereço</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <Label className="text-xs">CEP</Label>
                <div className="relative">
                  <Input value={endForm.cep} onChange={(e) => setEndForm({ ...endForm, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" />
                  {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Logradouro *</Label><Input value={endForm.logradouro} onChange={(e) => setEndForm({ ...endForm, logradouro: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Número</Label><Input value={endForm.numero} onChange={(e) => setEndForm({ ...endForm, numero: e.target.value })} /></div>
              <div className="space-y-1 col-span-2"><Label className="text-xs">Complemento</Label><Input value={endForm.complemento} onChange={(e) => setEndForm({ ...endForm, complemento: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Bairro</Label><Input value={endForm.bairro} onChange={(e) => setEndForm({ ...endForm, bairro: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2"><Label className="text-xs">Cidade *</Label><Input value={endForm.cidade} onChange={(e) => setEndForm({ ...endForm, cidade: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Estado *</Label><Input value={endForm.estado} onChange={(e) => setEndForm({ ...endForm, estado: e.target.value })} maxLength={2} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveNovoEndereco} disabled={savingEnd}>{savingEnd ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Checkout;
