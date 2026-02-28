import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Eye, Truck, Store, Clock, CalendarIcon, AlertTriangle, Split, Plus, Minus, Trash2, UserPlus, MapPin, PackagePlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useCep } from "@/hooks/useCep";

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

const origemLabels: Record<string, string> = {
  web: "Web", whatsapp: "WhatsApp", admin: "Admin",
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
  vendedor_id: string | null;
  cliente: { nome: string } | null;
  local_estoque: { nome: string } | null;
  vendedor: { nome: string } | null;
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

interface NovoPedidoItem {
  produto_id: string;
  nome: string;
  preco: number;
  quantidade: number;
}

/* ── Compras types ── */
interface ContaPagarCompra {
  contas_pagar_id: string; descricao: string; valor: number;
  data_vencimento: string; data_pagamento: string | null;
  pago: boolean; fornecedor_id: string | null;
  fornecedor: { nome: string } | null;
  observacao: string | null;
}
interface EntradaLinha {
  produto_id: string; nome: string; checked: boolean;
  quantidade: string; preco_venda: string; preco_custo: string;
}

function validateCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    // CPF validation
    if (/^(\d)\1{10}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    if (parseInt(digits[9]) !== check) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    return parseInt(digits[10]) === check;
  }
  if (digits.length === 14) {
    // CNPJ validation
    if (/^(\d)\1{13}$/.test(digits)) return false;
    const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
    let check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (parseInt(digits[12]) !== check) return false;
    const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    sum = 0;
    for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
    check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return parseInt(digits[13]) === check;
  }
  return false;
}

function getTipoEntrega(p: Pedido): { label: string; icon: typeof Truck } {
  if (p.local_estoque_id) return { label: "Retirada", icon: Store };
  return { label: "Entrega", icon: Truck };
}

const Pedidos = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [historico, setHistorico] = useState<StatusHistorico[]>([]);
  const [editStatus, setEditStatus] = useState("");
  const [editFrete, setEditFrete] = useState("");
  const [editLocalEstoqueId, setEditLocalEstoqueId] = useState<string | null>(null);
  const [editLocaisEstoque, setEditLocaisEstoque] = useState<{ local_estoque_id: string; nome: string }[]>([]);
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

  // New order dialog
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderClienteId, setNewOrderClienteId] = useState("");
  const [newOrderItems, setNewOrderItems] = useState<NovoPedidoItem[]>([]);
  const [newOrderObs, setNewOrderObs] = useState("");
  const [clientes, setClientes] = useState<{ cliente_id: string; nome: string }[]>([]);
  const [produtos, setProdutos] = useState<{ produto_id: string; nome: string; preco: number; fabricante_nome: string | null; peso_bruto: number | null; unidade_medida: string }[]>([]);
  const [newOrderSearch, setNewOrderSearch] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const [newOrderSaving, setNewOrderSaving] = useState(false);
  // Inline new client
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientNome, setNewClientNome] = useState("");
  const [newClientCpf, setNewClientCpf] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  // Delivery type
  const [newOrderTipoEntrega, setNewOrderTipoEntrega] = useState<"entrega" | "retirada">("retirada");
  const [locaisEstoque, setLocaisEstoque] = useState<{ local_estoque_id: string; nome: string }[]>([]);
  const [newOrderLocalEstoqueId, setNewOrderLocalEstoqueId] = useState("");
  // Address for entrega
  const [clienteEnderecos, setClienteEnderecos] = useState<{ endereco_id: string; logradouro: string; numero: string | null; bairro: string | null; cidade: string; estado: string; cep: string | null }[]>([]);
  const [newOrderEnderecoId, setNewOrderEnderecoId] = useState("");
  const [showNewEndereco, setShowNewEndereco] = useState(false);
  const [newEndereco, setNewEndereco] = useState({ cep: "", logradouro: "", numero: "", bairro: "", cidade: "", estado: "", complemento: "" });

  const { toast } = useToast();
  const { user } = useAuth();
  const { fetchCep, loading: cepLoading } = useCep();

  const load = async () => {
    const { data } = await supabase
      .from("pedido")
      .select("pedido_id, cliente_id, data, total, frete, status, origem, observacao, local_estoque_id, vendedor_id, cliente!pedido_cliente_id_fkey(nome), local_estoque(nome), vendedor:cliente!pedido_vendedor_id_fkey(nome)")
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

  /* ═══════════════ COMPRAS STATE ═══════════════ */
  const [compras, setCompras] = useState<ContaPagarCompra[]>([]);
  const [searchCompras, setSearchCompras] = useState("");
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [entradaFornecedores, setEntradaFornecedores] = useState<{ fornecedor_id: string; nome: string }[]>([]);
  const [entradaFornecedor, setEntradaFornecedor] = useState("");
  const [entradaNF, setEntradaNF] = useState("");
  const [entradaFrete, setEntradaFrete] = useState("");
  const [entradaLocal, setEntradaLocal] = useState("");
  const [entradaLocais, setEntradaLocais] = useState<{ local_estoque_id: string; nome: string }[]>([]);
  const [entradaLinhas, setEntradaLinhas] = useState<EntradaLinha[]>([]);
  const [entradaLoading, setEntradaLoading] = useState(false);
  const [entradaSearchProd, setEntradaSearchProd] = useState("");

  /* ── Compra edit state ── */
  const [compraEditOpen, setCompraEditOpen] = useState(false);
  const [compraEdit, setCompraEdit] = useState<{ contas_pagar_id: string; descricao: string; valor: string; data_vencimento: string; pago: boolean; observacao: string; fornecedor_id: string }>({ contas_pagar_id: "", descricao: "", valor: "", data_vencimento: "", pago: false, observacao: "", fornecedor_id: "" });
  const [compraEditLoading, setCompraEditLoading] = useState(false);
  const [compraEditFornecedores, setCompraEditFornecedores] = useState<{ fornecedor_id: string; nome: string }[]>([]);

  const loadCompras = async () => {
    const { data } = await supabase
      .from("contas_pagar")
      .select("contas_pagar_id, descricao, valor, data_vencimento, data_pagamento, pago, fornecedor_id, observacao, fornecedor(nome)")
      .order("data_vencimento", { ascending: false });
    if (data) setCompras(data as any);
  };

  useEffect(() => { loadCompras(); }, []);

  const openCompraEdit = async (c: ContaPagarCompra) => {
    const { data: forns } = await supabase.from("fornecedor").select("fornecedor_id, nome").eq("ativo", true).order("nome");
    if (forns) setCompraEditFornecedores(forns);
    setCompraEdit({
      contas_pagar_id: c.contas_pagar_id, descricao: c.descricao, valor: String(c.valor),
      data_vencimento: c.data_vencimento, pago: c.pago, observacao: c.observacao || "",
      fornecedor_id: c.fornecedor_id || "",
    });
    setCompraEditOpen(true);
  };

  const saveCompraEdit = async () => {
    setCompraEditLoading(true);
    const { error } = await supabase.from("contas_pagar").update({
      descricao: compraEdit.descricao, valor: Number(compraEdit.valor),
      data_vencimento: compraEdit.data_vencimento, pago: compraEdit.pago,
      observacao: compraEdit.observacao || null,
      fornecedor_id: compraEdit.fornecedor_id || null,
      data_pagamento: compraEdit.pago ? (new Date().toISOString().slice(0, 10)) : null,
    }).eq("contas_pagar_id", compraEdit.contas_pagar_id);
    setCompraEditLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Registro atualizado" });
    setCompraEditOpen(false);
    loadCompras();
  };

  const filteredCompras = compras.filter((c) => {
    const t = searchCompras.toLowerCase();
    return !t || c.descricao.toLowerCase().includes(t) || c.fornecedor?.nome?.toLowerCase().includes(t);
  });

  const fmtDate = (d: string | null) => d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—";
  const fmtMoney = (v: number) => `R$ ${Number(v).toFixed(2)}`;

  /* ── Entrada logic ── */
  const openEntrada = async () => {
    setEntradaFornecedor(""); setEntradaNF(""); setEntradaFrete(""); setEntradaLocal("");
    setEntradaLinhas([]); setEntradaSearchProd("");
    const [fRes, lRes] = await Promise.all([
      supabase.from("fornecedor").select("fornecedor_id, nome").eq("ativo", true).order("nome"),
      supabase.from("local_estoque").select("local_estoque_id, nome").eq("ativo", true).order("nome"),
    ]);
    if (fRes.data) setEntradaFornecedores(fRes.data);
    if (lRes.data) setEntradaLocais(lRes.data);
    setEntradaOpen(true);
  };

  const onEntradaFornecedorChange = async (fornecedorId: string) => {
    setEntradaFornecedor(fornecedorId);
    const { data: links } = await supabase.from("fornecedor_produto").select("produto_id").eq("fornecedor_id", fornecedorId);
    if (!links || links.length === 0) { setEntradaLinhas([]); return; }
    const prodIds = links.map((l) => l.produto_id);
    const { data: prods } = await supabase.from("produto").select("produto_id, nome, preco").in("produto_id", prodIds).eq("ativo", true).order("nome");
    const { data: existingEstoque } = await supabase.from("estoque_local").select("produto_id, preco_custo").in("produto_id", prodIds);
    const custoMap: Record<string, number> = {};
    if (existingEstoque) { for (const e of existingEstoque as any[]) { if (e.preco_custo && !custoMap[e.produto_id]) custoMap[e.produto_id] = e.preco_custo; } }
    if (prods) {
      setEntradaLinhas(prods.map((p) => ({
        produto_id: p.produto_id, nome: p.nome, checked: false, quantidade: "1",
        preco_venda: String(p.preco || 0), preco_custo: String(custoMap[p.produto_id] || 0),
      })));
    }
  };

  const toggleAllEntrada = (checked: boolean) => {
    const ids = new Set(filteredEntradaLinhas.map((l) => l.produto_id));
    setEntradaLinhas((prev) => prev.map((l) => ids.has(l.produto_id) ? { ...l, checked } : l));
  };

  const updateLinha = (produto_id: string, field: keyof EntradaLinha, value: any) => {
    setEntradaLinhas((prev) => prev.map((l) => l.produto_id === produto_id ? { ...l, [field]: value } : l));
  };

  const filteredEntradaLinhas = entradaLinhas
    .filter((l) => !entradaSearchProd || l.nome.toLowerCase().includes(entradaSearchProd.toLowerCase()))
    .sort((a, b) => { if (a.checked !== b.checked) return a.checked ? -1 : 1; return a.nome.localeCompare(b.nome, "pt-BR"); });

  const checkedLinhas = entradaLinhas.filter((l) => l.checked);
  const totalNF = checkedLinhas.reduce((sum, l) => sum + Number(l.preco_custo) * Number(l.quantidade), 0);

  const saveEntrada = async () => {
    if (!entradaLocal) { toast({ title: "Selecione o local de estoque", variant: "destructive" }); return; }
    if (checkedLinhas.length === 0) { toast({ title: "Marque ao menos um produto", variant: "destructive" }); return; }
    setEntradaLoading(true);
    try {
      for (const linha of checkedLinhas) {
        const qty = Number(linha.quantidade); const custoVal = Number(linha.preco_custo); const vendaVal = Number(linha.preco_venda);
        const { data: existing } = await supabase.from("estoque_local").select("estoque_local_id, quantidade_disponivel")
          .eq("produto_id", linha.produto_id).eq("local_estoque_id", entradaLocal).maybeSingle();
        if (existing) {
          await supabase.from("estoque_local").update({ quantidade_disponivel: Number(existing.quantidade_disponivel) + qty, preco_custo: custoVal, preco: vendaVal }).eq("estoque_local_id", existing.estoque_local_id);
        } else {
          await supabase.from("estoque_local").insert({ produto_id: linha.produto_id, local_estoque_id: entradaLocal, quantidade_disponivel: qty, preco_custo: custoVal, preco: vendaVal });
        }
        await supabase.from("produto").update({ preco: vendaVal }).eq("produto_id", linha.produto_id);
        // Registrar movimentação de estoque
        await supabase.from("movimentacao_estoque").insert({
          tipo: "entrada", produto_id: linha.produto_id, local_estoque_id: entradaLocal,
          quantidade: qty, documento: entradaNF ? `NF ${entradaNF}` : null, fornecedor_id: entradaFornecedor || null,
        });
      }
      const fornNome = entradaFornecedores.find((f) => f.fornecedor_id === entradaFornecedor)?.nome || "";
      if (totalNF > 0) {
        await supabase.from("contas_pagar").insert({ descricao: `NF ${entradaNF || "s/n"} - ${fornNome}`, valor: totalNF, data_vencimento: new Date().toISOString().slice(0, 10), fornecedor_id: entradaFornecedor });
      }
      const freteVal = Number(entradaFrete);
      if (freteVal > 0) {
        await supabase.from("contas_pagar").insert({ descricao: `Frete NF ${entradaNF || "s/n"} - ${fornNome}`, valor: freteVal, data_vencimento: new Date().toISOString().slice(0, 10), fornecedor_id: entradaFornecedor });
      }
      toast({ title: "Entrada registrada com sucesso!" });
      setEntradaOpen(false);
      loadCompras();
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); }
    finally { setEntradaLoading(false); }
  };

  const filtered = pedidos.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch = !term || p.cliente?.nome?.toLowerCase().includes(term) || p.pedido_id.includes(term);
    let matchStatus = true;
    if (statusFilter === "ativos") {
      matchStatus = p.status !== "entregue" && p.status !== "cancelado";
    } else if (statusFilter !== "todos") {
      matchStatus = p.status === statusFilter;
    }
    return matchSearch && matchStatus;
  });

  const openDetails = async (p: Pedido) => {
    setSelectedPedido(p);
    setEditStatus(p.status);
    setEditFrete(Number(p.frete).toFixed(2));
    setEditLocalEstoqueId(p.local_estoque_id);
    setPagFormaId("");
    setPagBancoId("");
    setPagData(new Date());

    // Load locais estoque for editing
    const leRes = await supabase.from("local_estoque").select("local_estoque_id, nome").eq("ativo", true).order("nome");
    if (leRes.data) setEditLocaisEstoque(leRes.data);
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
      setEditStatus(s);
      setStockCheckPassed(false);
      const issues = await checkStock();
      if (issues.length > 0) {
        setStockIssues(issues);
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

  const checkStock = async (): Promise<StockIssue[]> => {
    if (!selectedPedido) return [];
    const issues: StockIssue[] = [];

    for (const item of items) {
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

    const newItems = splitItems.map(item => ({
      pedido_id: newOrder.pedido_id,
      produto_id: item.produto_id,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
    }));
    await supabase.from("pedido_item").insert(newItems);

    await supabase.from("pedido_status_historico").insert({
      pedido_id: newOrder.pedido_id,
      status: "separacao" as any,
    });

    for (const item of splitItems) {
      await supabase.from("pedido_item").delete().eq("pedido_item_id", item.pedido_item_id);
    }

    const remainingItems = items.filter(i => !selectedProductIds.includes(i.produto_id));
    setItems(remainingItems);

    toast({ title: `Pedido desmembrado`, description: `Novo pedido criado com ${splitItems.length} item(ns) — R$ ${newOrderTotal.toFixed(2)}` });
  };

  const createContaReceber = async (pedidoId: string, clienteId: string, valor: number, dataPagamento: Date) => {
    const { data: existing } = await supabase.from("contas_receber").select("contas_receber_id").eq("pedido_id", pedidoId).limit(1);
    if (existing && existing.length > 0) return;

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

    // Require local_estoque when moving to aguardando_pagamento
    if (editStatus === "aguardando_pagamento" && !editLocalEstoqueId) {
      toast({ title: "Selecione o local de estoque antes de passar para Aguardando Pagamento", variant: "destructive" });
      return;
    }

    if (isEntrega && editStatus !== "separacao" && editStatus !== "carrinho" && editStatus !== "cancelado" && freteNum <= 0) {
      toast({ title: "Informe o valor do frete para pedidos de entrega", variant: "destructive" });
      return;
    }

    if (editStatus === "pago" && selectedPedido.status === "aguardando_pagamento" && !stockCheckPassed) {
      toast({ title: "Verifique o estoque antes de marcar como pago", variant: "destructive" });
      return;
    }

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
    // Update local_estoque_id if changed during separacao
    if (selectedPedido.status === "separacao" && editLocalEstoqueId !== selectedPedido.local_estoque_id) {
      updateData.local_estoque_id = editLocalEstoqueId || null;
    }

    const { error } = await supabase.from("pedido").update(updateData).eq("pedido_id", selectedPedido.pedido_id);
    if (!error) {
      if (editStatus !== selectedPedido.status) {
        await supabase.from("pedido_status_historico").insert({
          pedido_id: selectedPedido.pedido_id,
          status: editStatus as any,
        });
      }

      // Handle quantidade_pedida_nao_separada
      const localId = editLocalEstoqueId || selectedPedido.local_estoque_id;

      // When moving to aguardando_pagamento and local was just set, increment pedida_nao_separada
      if (editStatus === "aguardando_pagamento" && selectedPedido.status === "separacao" && localId) {
        for (const item of items) {
          const { data: el } = await supabase.from("estoque_local")
            .select("estoque_local_id, quantidade_pedida_nao_separada")
            .eq("produto_id", item.produto_id).eq("local_estoque_id", localId).maybeSingle();
          if (el) {
            await supabase.from("estoque_local").update({
              quantidade_pedida_nao_separada: Number(el.quantidade_pedida_nao_separada) + Number(item.quantidade),
            }).eq("estoque_local_id", el.estoque_local_id);
          } else {
            await supabase.from("estoque_local").insert({
              produto_id: item.produto_id, local_estoque_id: localId,
              quantidade_disponivel: 0, quantidade_pedida_nao_separada: Number(item.quantidade),
            });
          }
        }
      }

      // When moving to pago, decrement pedida_nao_separada
      if (editStatus === "pago" && selectedPedido.status === "aguardando_pagamento" && localId) {
        for (const item of items) {
          const { data: el } = await supabase.from("estoque_local")
            .select("estoque_local_id, quantidade_pedida_nao_separada")
            .eq("produto_id", item.produto_id).eq("local_estoque_id", localId).maybeSingle();
          if (el) {
            await supabase.from("estoque_local").update({
              quantidade_pedida_nao_separada: Math.max(0, Number(el.quantidade_pedida_nao_separada) - Number(item.quantidade)),
            }).eq("estoque_local_id", el.estoque_local_id);
          }
        }
        await deductStock();
      }

      // When canceling, decrement pedida_nao_separada if was in aguardando_pagamento or separacao with local
      if (editStatus === "cancelado" && localId && 
          (selectedPedido.status === "aguardando_pagamento" || (selectedPedido.status === "separacao" && selectedPedido.local_estoque_id))) {
        for (const item of items) {
          const { data: el } = await supabase.from("estoque_local")
            .select("estoque_local_id, quantidade_pedida_nao_separada")
            .eq("produto_id", item.produto_id).eq("local_estoque_id", localId).maybeSingle();
          if (el) {
            await supabase.from("estoque_local").update({
              quantidade_pedida_nao_separada: Math.max(0, Number(el.quantidade_pedida_nao_separada) - Number(item.quantidade)),
            }).eq("estoque_local_id", el.estoque_local_id);
          }
        }
      }

      // When going back from aguardando_pagamento to separacao, decrement pedida_nao_separada
      if (editStatus === "separacao" && selectedPedido.status === "aguardando_pagamento" && localId) {
        for (const item of items) {
          const { data: el } = await supabase.from("estoque_local")
            .select("estoque_local_id, quantidade_pedida_nao_separada")
            .eq("produto_id", item.produto_id).eq("local_estoque_id", localId).maybeSingle();
          if (el) {
            await supabase.from("estoque_local").update({
              quantidade_pedida_nao_separada: Math.max(0, Number(el.quantidade_pedida_nao_separada) - Number(item.quantidade)),
            }).eq("estoque_local_id", el.estoque_local_id);
          }
        }
      }

      if (needsPaymentInfo) {
        await supabase.from("pedido_pagamento").insert({
          pedido_id: selectedPedido.pedido_id,
          forma_pagamento_id: pagFormaId,
          banco_id: pagBancoId,
          data_pagamento: pagData!.toISOString(),
          valor: newTotal,
        });

        await createContaReceber(selectedPedido.pedido_id, selectedPedido.cliente_id, newTotal, pagData!);
      }

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

  // ===== NEW ORDER LOGIC =====
  const openNewOrder = async () => {
    setNewOrderClienteId("");
    setNewOrderItems([]);
    setNewOrderObs("");
    setNewOrderSearch("");
    setClienteSearch("");
    setClienteDropdownOpen(false);
    setShowNewClient(false);
    setNewClientNome("");
    setNewClientCpf("");
    setNewClientEmail("");
    setNewOrderTipoEntrega("retirada");
    setNewOrderLocalEstoqueId("");
    setClienteEnderecos([]);
    setNewOrderEnderecoId("");
    setShowNewEndereco(false);
    setNewEndereco({ cep: "", logradouro: "", numero: "", bairro: "", cidade: "", estado: "", complemento: "" });

    const [cRes, pRes, leRes] = await Promise.all([
      supabase.from("cliente").select("cliente_id, nome").eq("ativo", true).order("nome"),
      supabase.from("produto").select("produto_id, nome, preco, peso_bruto, unidade_medida, fabricante:fabricante_id(nome)").eq("ativo", true).order("nome"),
      supabase.from("local_estoque").select("local_estoque_id, nome").eq("ativo", true).order("nome"),
    ]);
    if (cRes.data) setClientes(cRes.data);
    if (pRes.data) setProdutos(pRes.data.map((p: any) => ({ ...p, fabricante_nome: p.fabricante?.nome ?? null })));
    if (leRes.data) setLocaisEstoque(leRes.data);
    setNewOrderOpen(true);
  };

  // Load client addresses when client changes
  const loadClienteEnderecos = async (clienteId: string) => {
    if (!clienteId || clienteId === "__none") {
      setClienteEnderecos([]);
      return;
    }
    const { data } = await supabase
      .from("cliente_endereco")
      .select("endereco_id, endereco:endereco_id(endereco_id, logradouro, numero, bairro, cidade, estado, cep)")
      .eq("cliente_id", clienteId);
    if (data) {
      setClienteEnderecos(data.map((d: any) => d.endereco).filter(Boolean));
    }
  };

  const filteredClientes = useMemo(() => {
    if (!clienteSearch.trim()) return clientes;
    const term = clienteSearch.toLowerCase();
    return clientes.filter(c => c.nome.toLowerCase().includes(term));
  }, [clientes, clienteSearch]);

  const filteredProdutos = useMemo(() => {
    if (!newOrderSearch.trim()) return produtos;
    const term = newOrderSearch.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(term) || p.fabricante_nome?.toLowerCase().includes(term));
  }, [produtos, newOrderSearch]);

  const addProduct = (p: { produto_id: string; nome: string; preco: number }) => {
    setNewOrderItems(prev => {
      const existing = prev.find(i => i.produto_id === p.produto_id);
      if (existing) return prev.map(i => i.produto_id === p.produto_id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { produto_id: p.produto_id, nome: p.nome, preco: p.preco, quantidade: 1 }];
    });
  };

  const updateQty = (produtoId: string, delta: number) => {
    setNewOrderItems(prev => prev.map(i => {
      if (i.produto_id !== produtoId) return i;
      const newQty = i.quantidade + delta;
      return newQty > 0 ? { ...i, quantidade: newQty } : i;
    }));
  };

  const removeItem = (produtoId: string) => {
    setNewOrderItems(prev => prev.filter(i => i.produto_id !== produtoId));
  };

  const newOrderTotal = newOrderItems.reduce((s, i) => s + i.preco * i.quantidade, 0);

  const getVendedorClienteId = async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from("cliente").select("cliente_id").eq("user_id", user.id).limit(1).single();
    return data?.cliente_id || null;
  };

  const saveNewOrder = async () => {
    if (newOrderItems.length === 0) {
      toast({ title: "Adicione ao menos um produto", variant: "destructive" });
      return;
    }

    // Validate entrega requires a real client
    if (newOrderTipoEntrega === "entrega") {
      const hasClient = newOrderClienteId && newOrderClienteId !== "__none";
      if (!hasClient && !showNewClient) {
        toast({ title: "Para entrega, selecione ou cadastre um cliente", variant: "destructive" });
        return;
      }
    }

    if (newOrderTipoEntrega === "retirada" && !newOrderLocalEstoqueId) {
      toast({ title: "Selecione o local de retirada", variant: "destructive" });
      return;
    }

    setNewOrderSaving(true);

    let clienteId = newOrderClienteId === "__none" ? "" : newOrderClienteId;

    // Create new client inline if needed
    if (showNewClient && newClientNome) {
      if (newClientCpf && !validateCpfCnpj(newClientCpf)) {
        toast({ title: "CPF/CNPJ inválido", description: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido", variant: "destructive" });
        setNewOrderSaving(false);
        return;
      }
      const { data: newCliente, error: clienteError } = await supabase
        .from("cliente")
        .insert({ nome: newClientNome, cpf_cnpj: newClientCpf || null, email: newClientEmail || null })
        .select("cliente_id")
        .single();
      if (clienteError || !newCliente) {
        toast({ title: "Erro ao criar cliente", description: clienteError?.message, variant: "destructive" });
        setNewOrderSaving(false);
        return;
      }
      clienteId = newCliente.cliente_id;
    }

    // If no client selected, reuse existing "Consumidor Final" or create one
    if (!clienteId) {
      const { data: existing } = await supabase
        .from("cliente")
        .select("cliente_id")
        .eq("nome", "Consumidor Final")
        .eq("tipo_cliente", "cliente")
        .limit(1)
        .single();
      if (existing) {
        clienteId = existing.cliente_id;
      } else {
        const { data: anonCliente, error: anonError } = await supabase
          .from("cliente")
          .insert({ nome: "Consumidor Final" })
          .select("cliente_id")
          .single();
        if (anonError || !anonCliente) {
          toast({ title: "Erro ao criar cliente avulso", description: anonError?.message, variant: "destructive" });
          setNewOrderSaving(false);
          return;
        }
        clienteId = anonCliente.cliente_id;
      }
    }

    // Create new address if needed for entrega
    if (newOrderTipoEntrega === "entrega" && showNewEndereco && newEndereco.logradouro) {
      const { data: endData, error: endError } = await supabase
        .from("endereco")
        .insert({
          logradouro: newEndereco.logradouro,
          numero: newEndereco.numero || null,
          bairro: newEndereco.bairro || null,
          cidade: newEndereco.cidade,
          estado: newEndereco.estado,
          cep: newEndereco.cep || null,
          complemento: newEndereco.complemento || null,
        })
        .select("endereco_id")
        .single();
      if (!endError && endData) {
        // Link address to client
        await supabase.from("cliente_endereco").insert({ cliente_id: clienteId, endereco_id: endData.endereco_id });
      }
    }

    // Get vendedor_id from current user
    const vendedorId = await getVendedorClienteId();

    const { data: pedido, error } = await supabase
      .from("pedido")
      .insert({
        cliente_id: clienteId,
        total: newOrderTotal,
        frete: 0,
        status: "separacao" as any,
        origem: "admin" as any,
        vendedor_id: vendedorId,
        local_estoque_id: newOrderTipoEntrega === "retirada" ? newOrderLocalEstoqueId : null,
        observacao: newOrderObs || null,
      })
      .select("pedido_id")
      .single();

    if (error || !pedido) {
      toast({ title: "Erro ao criar pedido", description: error?.message, variant: "destructive" });
      setNewOrderSaving(false);
      return;
    }

    // Insert items
    const pedidoItems = newOrderItems.map(i => ({
      pedido_id: pedido.pedido_id,
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      preco_unitario: i.preco,
    }));
    await supabase.from("pedido_item").insert(pedidoItems);

    // Increment quantidade_pedida_nao_separada for vendor orders with local
    if (newOrderTipoEntrega === "retirada" && newOrderLocalEstoqueId) {
      for (const item of newOrderItems) {
        const { data: existing } = await supabase.from("estoque_local")
          .select("estoque_local_id, quantidade_pedida_nao_separada")
          .eq("produto_id", item.produto_id)
          .eq("local_estoque_id", newOrderLocalEstoqueId)
          .maybeSingle();
        if (existing) {
          await supabase.from("estoque_local").update({
            quantidade_pedida_nao_separada: Number(existing.quantidade_pedida_nao_separada) + item.quantidade,
          }).eq("estoque_local_id", existing.estoque_local_id);
        } else {
          await supabase.from("estoque_local").insert({
            produto_id: item.produto_id,
            local_estoque_id: newOrderLocalEstoqueId,
            quantidade_disponivel: 0,
            quantidade_pedida_nao_separada: item.quantidade,
          });
        }
      }
    }

    // Insert status history
    await supabase.from("pedido_status_historico").insert({
      pedido_id: pedido.pedido_id,
      status: "separacao" as any,
    });

    toast({ title: "Pedido criado com sucesso" });
    setNewOrderOpen(false);
    setNewOrderSaving(false);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos</h1>

      <Tabs defaultValue="vendas">
        <TabsList>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div />
        <Button onClick={openNewOrder} className="gap-2"><Plus className="h-4 w-4" /> Novo Pedido</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
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
              <TableHead className="hidden md:table-cell">Local</TableHead>
              <TableHead className="hidden sm:table-cell">Origem</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
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
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {p.local_estoque?.nome || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-muted">{origemLabels[p.origem] || p.origem}</span>
                      {p.vendedor?.nome && <div className="text-muted-foreground mt-0.5">{p.vendedor.nome}</div>}
                    </div>
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

      {/* Detail dialog */}
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
                <div><span className="text-muted-foreground">Origem:</span> {origemLabels[selectedPedido.origem] || selectedPedido.origem}{selectedPedido.vendedor?.nome && ` — ${selectedPedido.vendedor.nome}`}</div>
                <div>
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

              {/* Local de Estoque - editable only during separacao */}
              {selectedPedido.status === "separacao" && (
                <div className="space-y-2">
                  <Label>Local de Estoque</Label>
                  <Select value={editLocalEstoqueId || ""} onValueChange={(v) => setEditLocalEstoqueId(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o local de estoque" /></SelectTrigger>
                    <SelectContent>
                      {editLocaisEstoque.map(l => (
                        <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!editLocalEstoqueId && (
                    <p className="text-xs text-destructive">Obrigatório para avançar para Aguardando Pagamento</p>
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
            <Button onClick={() => updatePedido()} disabled={loading || (editStatus === selectedPedido?.status && editFrete === Number(selectedPedido?.frete || 0).toFixed(2) && editLocalEstoqueId === selectedPedido?.local_estoque_id)}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
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

      {/* Stock issues dialog */}
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
                const remainingItems = items.filter(i => !selected.includes(i.produto_id));
                const remainingTotal = remainingItems.reduce((sum, i) => sum + Number(i.preco_unitario) * Number(i.quantidade), 0);
                const newOriginalTotal = remainingTotal + freteNum;
                await supabase.from("pedido").update({ total: newOriginalTotal }).eq("pedido_id", selectedPedido!.pedido_id);
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

      {/* New order dialog */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pedido</DialogTitle>
            <DialogDescription>Crie um pedido pelo painel administrativo</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client selection */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              {!showNewClient ? (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente por nome..."
                        value={clienteSearch}
                        onChange={e => { setClienteSearch(e.target.value); setClienteDropdownOpen(true); }}
                        onFocus={() => setClienteDropdownOpen(true)}
                        className="pl-10"
                      />
                    </div>
                    {newOrderClienteId && newOrderClienteId !== "__none" && (
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {clientes.find(c => c.cliente_id === newOrderClienteId)?.nome || "Cliente selecionado"}
                        </Badge>
                        <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setNewOrderClienteId("__none"); setClienteEnderecos([]); setNewOrderEnderecoId(""); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {clienteDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 border rounded-lg bg-popover shadow-md max-h-40 overflow-y-auto">
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground"
                          onClick={() => { setNewOrderClienteId("__none"); setClienteSearch(""); setClienteDropdownOpen(false); setClienteEnderecos([]); }}
                        >
                          Sem cliente (Consumidor Final)
                        </button>
                        {filteredClientes.slice(0, 20).map(c => (
                          <button
                            key={c.cliente_id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => { setNewOrderClienteId(c.cliente_id); setClienteSearch(""); setClienteDropdownOpen(false); loadClienteEnderecos(c.cliente_id); setNewOrderEnderecoId(""); setShowNewEndereco(false); }}
                          >
                            {c.nome}
                          </button>
                        ))}
                        {filteredClientes.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum cliente encontrado</p>}
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowNewClient(true)} title="Cadastrar novo cliente">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Novo Cliente</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewClient(false); setNewClientNome(""); }}>Cancelar</Button>
                  </div>
                  <div className="space-y-2">
                    <Input placeholder="Nome *" value={newClientNome} onChange={e => setNewClientNome(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="CPF/CNPJ" value={newClientCpf} onChange={e => setNewClientCpf(e.target.value)} />
                      <Input placeholder="Email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Delivery type */}
            <div className="space-y-2">
              <Label>Tipo de Entrega</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newOrderTipoEntrega === "retirada" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setNewOrderTipoEntrega("retirada")}
                >
                  <Store className="h-3.5 w-3.5" /> Retirada
                </Button>
                <Button
                  type="button"
                  variant={newOrderTipoEntrega === "entrega" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (!newOrderClienteId || newOrderClienteId === "__none") {
                      if (!showNewClient) {
                        toast({ title: "Para entrega, selecione ou cadastre um cliente", variant: "destructive" });
                        return;
                      }
                    }
                    setNewOrderTipoEntrega("entrega");
                  }}
                >
                  <Truck className="h-3.5 w-3.5" /> Entrega
                </Button>
              </div>

              {newOrderTipoEntrega === "retirada" && (
                <div className="space-y-2">
                  <Label className="text-sm">Local de Retirada *</Label>
                  <Select value={newOrderLocalEstoqueId} onValueChange={setNewOrderLocalEstoqueId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o local" /></SelectTrigger>
                    <SelectContent>
                      {locaisEstoque.map(l => (
                        <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newOrderTipoEntrega === "entrega" && (
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Endereço de Entrega</Label>
                  {!showNewEndereco ? (
                    <div className="space-y-2">
                      {clienteEnderecos.length > 0 ? (
                        <Select value={newOrderEnderecoId} onValueChange={setNewOrderEnderecoId}>
                          <SelectTrigger><SelectValue placeholder="Selecione o endereço" /></SelectTrigger>
                          <SelectContent>
                            {clienteEnderecos.map(e => (
                              <SelectItem key={e.endereco_id} value={e.endereco_id}>
                                {e.logradouro}{e.numero ? `, ${e.numero}` : ""} — {e.cidade}/{e.estado}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado para este cliente.</p>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowNewEndereco(true)} className="gap-1.5">
                        <Plus className="h-3 w-3" /> Cadastrar novo endereço
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold">Novo Endereço</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewEndereco(false)}>Cancelar</Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="CEP"
                            value={newEndereco.cep}
                            onChange={e => setNewEndereco({ ...newEndereco, cep: e.target.value })}
                            className="w-32"
                            onBlur={async () => {
                              const data = await fetchCep(newEndereco.cep);
                              if (data) {
                                setNewEndereco(prev => ({
                                  ...prev,
                                  logradouro: data.street || prev.logradouro,
                                  bairro: data.neighborhood || prev.bairro,
                                  cidade: data.city || prev.cidade,
                                  estado: data.state || prev.estado,
                                }));
                              }
                            }}
                          />
                          {cepLoading && <span className="text-xs text-muted-foreground self-center">Buscando...</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input placeholder="Logradouro *" value={newEndereco.logradouro} onChange={e => setNewEndereco({ ...newEndereco, logradouro: e.target.value })} className="col-span-2" />
                          <Input placeholder="Número" value={newEndereco.numero} onChange={e => setNewEndereco({ ...newEndereco, numero: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Bairro" value={newEndereco.bairro} onChange={e => setNewEndereco({ ...newEndereco, bairro: e.target.value })} />
                          <Input placeholder="Complemento" value={newEndereco.complemento} onChange={e => setNewEndereco({ ...newEndereco, complemento: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Cidade *" value={newEndereco.cidade} onChange={e => setNewEndereco({ ...newEndereco, cidade: e.target.value })} />
                          <Input placeholder="Estado *" value={newEndereco.estado} onChange={e => setNewEndereco({ ...newEndereco, estado: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product search and add */}
            <div className="space-y-2">
              <Label>Produtos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={newOrderSearch} onChange={e => setNewOrderSearch(e.target.value)} className="pl-10" />
              </div>
              {newOrderSearch.trim() && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {filteredProdutos.slice(0, 20).map(p => (
                    <button
                      key={p.produto_id}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors gap-2"
                      onClick={() => { addProduct(p); setNewOrderSearch(""); }}
                    >
                      <div className="flex flex-col items-start text-left min-w-0">
                        <span className="font-medium truncate w-full">{p.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.fabricante_nome || "—"}
                          {p.peso_bruto != null && ` · ${p.peso_bruto}${p.unidade_medida}`}
                        </span>
                      </div>
                      <span className="text-muted-foreground whitespace-nowrap">R$ {p.preco.toFixed(2)}</span>
                    </button>
                  ))}
                  {filteredProdutos.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum produto encontrado</p>}
                </div>
              )}
            </div>

            {/* Items list */}
            {newOrderItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-32 text-center">Qtd</TableHead>
                      <TableHead className="w-24 text-right">Preço</TableHead>
                      <TableHead className="w-24 text-right">Subtotal</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newOrderItems.map(i => (
                      <TableRow key={i.produto_id}>
                        <TableCell className="text-sm">{i.nome}</TableCell>
                        <TableCell>
                          <Input type="number" min="1" className="h-8 w-20 text-sm text-center" value={i.quantidade}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setNewOrderItems(prev => prev.map(item => item.produto_id === i.produto_id ? { ...item, quantidade: val } : item));
                            }} />
                        </TableCell>
                        <TableCell className="text-right text-sm">R$ {i.preco.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">R$ {(i.preco * i.quantidade).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i.produto_id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end px-4 py-2 border-t bg-muted/30">
                  <span className="font-semibold">Total: R$ {newOrderTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Observation */}
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input placeholder="Observação (opcional)" value={newOrderObs} onChange={e => setNewOrderObs(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrderOpen(false)}>Cancelar</Button>
            <Button onClick={saveNewOrder} disabled={newOrderSaving || newOrderItems.length === 0 || (showNewClient && !newClientNome)}>
              {newOrderSaving ? "Criando..." : "Criar Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* ══════════ TAB COMPRAS ══════════ */}
        <TabsContent value="compras" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por descrição ou fornecedor..." value={searchCompras} onChange={(e) => setSearchCompras(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={openEntrada} className="gap-2"><PackagePlus className="h-4 w-4" /> Entrada</Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                 <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden sm:table-cell">Fornecedor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompras.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pedido de compra encontrado</TableCell></TableRow>
                ) : filteredCompras.map((c) => (
                  <TableRow key={c.contas_pagar_id}>
                    <TableCell className="font-medium">{c.descricao}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{c.fornecedor?.nome || "—"}</TableCell>
                    <TableCell>{fmtDate(c.data_vencimento)}</TableCell>
                    <TableCell>{fmtMoney(c.valor)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.pago ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {c.pago ? "Pago" : "Pendente"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openCompraEdit(c)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Compra Edit dialog ── */}
      <Dialog open={compraEditOpen} onOpenChange={setCompraEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={compraEdit.descricao} onChange={(e) => setCompraEdit({ ...compraEdit, descricao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={compraEdit.fornecedor_id} onValueChange={(v) => setCompraEdit({ ...compraEdit, fornecedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{compraEditFornecedores.map((f) => <SelectItem key={f.fornecedor_id} value={f.fornecedor_id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={compraEdit.valor} onChange={(e) => setCompraEdit({ ...compraEdit, valor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input type="date" value={compraEdit.data_vencimento} onChange={(e) => setCompraEdit({ ...compraEdit, data_vencimento: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={compraEdit.observacao} onChange={(e) => setCompraEdit({ ...compraEdit, observacao: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={compraEdit.pago} onCheckedChange={(v) => setCompraEdit({ ...compraEdit, pago: !!v })} />
              <Label>Pago</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompraEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveCompraEdit} disabled={compraEditLoading || !compraEdit.descricao || !compraEdit.valor}>
              {compraEditLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Entrada dialog ── */}
      <Dialog open={entradaOpen} onOpenChange={setEntradaOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Entrada de Mercadoria</DialogTitle><DialogDescription>Registre a entrada de produtos no estoque</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                <Select value={entradaFornecedor} onValueChange={onEntradaFornecedorChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{entradaFornecedores.map((f) => <SelectItem key={f.fornecedor_id} value={f.fornecedor_id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Nota Fiscal</Label><Input value={entradaNF} onChange={(e) => setEntradaNF(e.target.value)} placeholder="Número NF" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Valor Frete (R$)</Label><Input type="number" step="0.01" value={entradaFrete} onChange={(e) => setEntradaFrete(e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-2">
                <Label>Local de Estoque *</Label>
                <Select value={entradaLocal} onValueChange={setEntradaLocal}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{entradaLocais.map((l) => <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {entradaLinhas.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Filtrar produtos..." value={entradaSearchProd} onChange={(e) => setEntradaSearchProd(e.target.value)} className="pl-10" />
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{checkedLinhas.length} selecionado(s)</span>
                </div>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"><Checkbox checked={filteredEntradaLinhas.length > 0 && filteredEntradaLinhas.every((l) => l.checked)} onCheckedChange={(c) => toggleAllEntrada(!!c)} /></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-20">Qtd</TableHead>
                        <TableHead className="w-28">Custo</TableHead>
                        <TableHead className="w-28">Venda</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntradaLinhas.map((l) => (
                        <TableRow key={l.produto_id} className={l.checked ? "bg-primary/5" : ""}>
                          <TableCell><Checkbox checked={l.checked} onCheckedChange={(c) => updateLinha(l.produto_id, "checked", !!c)} /></TableCell>
                          <TableCell className="text-sm">{l.nome}</TableCell>
                          <TableCell><Input type="number" min="1" className="h-8 text-sm" value={l.quantidade} onChange={(e) => updateLinha(l.produto_id, "quantidade", e.target.value)} /></TableCell>
                          <TableCell><Input type="number" step="0.01" className="h-8 text-sm" value={l.preco_custo} onChange={(e) => updateLinha(l.produto_id, "preco_custo", e.target.value)} /></TableCell>
                          <TableCell><Input type="number" step="0.01" className="h-8 text-sm" value={l.preco_venda} onChange={(e) => updateLinha(l.produto_id, "preco_venda", e.target.value)} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end text-sm font-semibold">Total NF: R$ {totalNF.toFixed(2)}</div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntradaOpen(false)}>Cancelar</Button>
            <Button onClick={saveEntrada} disabled={entradaLoading || checkedLinhas.length === 0}>
              {entradaLoading ? "Salvando..." : "Confirmar Entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pedidos;
