import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, ArrowLeft, LogIn, Truck, Store, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
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

function validateCpfCnpj(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "CPF ou CNPJ é obrigatório";
  if (digits.length <= 11) {
    if (digits.length !== 11) return "CPF deve ter 11 dígitos";
    if (!validateCpf(digits)) return "CPF inválido";
  } else {
    if (digits.length !== 14) return "CNPJ deve ter 14 dígitos";
    if (!validateCnpj(digits)) return "CNPJ inválido";
  }
  return null;
}

interface LocalEstoque {
  local_estoque_id: string;
  nome: string;
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
  const [locais, setLocais] = useState<LocalEstoque[]>([]);
  const [localSelecionado, setLocalSelecionado] = useState("");

  // Load locais and pre-fill CPF/CNPJ from cliente
  useEffect(() => {
    supabase
      .from("local_estoque")
      .select("local_estoque_id, nome")
      .eq("ativo", true)
      .then(({ data }) => {
        if (data) setLocais(data);
      });

    if (user) {
      supabase
        .from("cliente")
        .select("cpf_cnpj")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.cpf_cnpj) {
            setCpfCnpj(formatCpfCnpj(data.cpf_cnpj));
          }
        });
    }
  }, [user]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground stroke-1" />
        <p className="text-lg text-muted-foreground">Seu carrinho está vazio</p>
        <Link to="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Button>
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <LogIn className="h-16 w-16 text-muted-foreground stroke-1" />
        <p className="text-lg text-muted-foreground">Faça login para finalizar o pedido</p>
        <Link to="/auth?redirect=/checkout">
          <Button className="gap-2">
            <LogIn className="h-4 w-4" /> Entrar / Cadastrar
          </Button>
        </Link>
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Button>
        </Link>
      </div>
    );
  }

  const handleCpfCnpjChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    setCpfCnpj(formatCpfCnpj(digits));
    if (cpfCnpjError) setCpfCnpjError(null);
  };

  const handleFinalize = async () => {
    const error = validateCpfCnpj(cpfCnpj);
    if (error) {
      setCpfCnpjError(error);
      return;
    }
    if (!tipoEntrega) {
      toast({ title: "Selecione o tipo de entrega", variant: "destructive" });
      return;
    }
    if (tipoEntrega === "retirada" && !localSelecionado) {
      toast({ title: "Selecione o local de retirada", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const cleanCpfCnpj = cpfCnpj.replace(/\D/g, "");

      // Find or create cliente for this user
      let { data: cliente } = await supabase
        .from("cliente")
        .select("cliente_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cliente) {
        const { data: newCliente, error: cErr } = await supabase
          .from("cliente")
          .insert({ nome: user.email ?? "Cliente", email: user.email, user_id: user.id, cpf_cnpj: cleanCpfCnpj })
          .select("cliente_id")
          .single();
        if (cErr) throw cErr;
        cliente = newCliente;
      } else {
        // Update CPF/CNPJ
        await supabase.from("cliente").update({ cpf_cnpj: cleanCpfCnpj }).eq("cliente_id", cliente.cliente_id);
      }

      // Create pedido
      const { data: pedido, error: pErr } = await supabase
        .from("pedido")
        .insert({
          cliente_id: cliente!.cliente_id,
          total,
          status: "separacao",
          origem: "web",
          local_estoque_id: tipoEntrega === "retirada" ? localSelecionado : null,
          observacao: tipoEntrega === "entrega" ? "Entrega — frete a calcular" : `Retirada no local`,
        })
        .select("pedido_id")
        .single();
      if (pErr) throw pErr;

      // Create pedido_items
      const pedidoItems = items.map((item) => ({
        pedido_id: pedido!.pedido_id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco,
      }));

      const { error: iErr } = await supabase.from("pedido_item").insert(pedidoItems);
      if (iErr) throw iErr;

      // Create status history
      await supabase.from("pedido_status_historico").insert({
        pedido_id: pedido!.pedido_id,
        status: "separacao",
        usuario_id: user.id,
      });

      clearCart();
      toast({ title: "Pedido criado com sucesso!", description: "Acompanhe o status no seu perfil." });
      navigate("/perfil");
    } catch (err: any) {
      toast({ title: "Erro ao criar pedido", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && cpfCnpj.length > 0 && tipoEntrega !== "" && (tipoEntrega === "entrega" || localSelecionado !== "");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
        </Link>

        <h1 className="text-2xl font-bold mb-6">Finalizar Pedido</h1>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Itens do pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div key={item.produto_id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{item.nome}</p>
                  <p className="text-xs text-muted-foreground">{item.quantidade}x R$ {item.preco.toFixed(2)}</p>
                </div>
                <span className="font-semibold text-sm">
                  R$ {(item.preco * item.quantidade).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* CPF/CNPJ */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">CPF ou CNPJ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="cpfcnpj">Informe seu CPF ou CNPJ</Label>
              <Input
                id="cpfcnpj"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={cpfCnpj}
                onChange={(e) => handleCpfCnpjChange(e.target.value)}
                className={cpfCnpjError ? "border-destructive" : ""}
              />
              {cpfCnpjError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {cpfCnpjError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tipo de entrega */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Entrega ou Retirada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={tipoEntrega} onValueChange={(v) => setTipoEntrega(v as "entrega" | "retirada")}>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => setTipoEntrega("entrega")}>
                <RadioGroupItem value="entrega" id="entrega" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="entrega" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Truck className="h-4 w-4" /> Entrega
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">Receba no seu endereço</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => setTipoEntrega("retirada")}>
                <RadioGroupItem value="retirada" id="retirada" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="retirada" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Store className="h-4 w-4" /> Retirada no local
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">Retire em uma de nossas unidades</p>
                </div>
              </div>
            </RadioGroup>

            {tipoEntrega === "entrega" && (
              <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  O frete será calculado e informado posteriormente pela nossa equipe.
                </p>
              </div>
            )}

            {tipoEntrega === "retirada" && (
              <div className="space-y-2">
                <Label>Local de retirada</Label>
                <Select value={localSelecionado} onValueChange={setLocalSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o local..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locais.map((l) => (
                      <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={handleFinalize} disabled={!canSubmit}>
          {loading ? "Processando..." : "Confirmar Pedido"}
        </Button>
      </div>
    </div>
  );
};

export default Checkout;
