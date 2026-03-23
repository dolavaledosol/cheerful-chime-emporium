import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Send, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ProdutoEstoque {
  produto_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  peso_liquido: number | null;
  unidade_medida: string;
  familia: string;
  fabricante: string;
  imagem_url: string | null;
  total_estoque: number;
  checked: boolean;
}

interface ClienteProdutoCompra {
  produto_id: string;
  produto_nome: string;
  peso: number | null;
  unidade_medida: string;
  valor: number;
  quantidade: number;
  data_compra: string;
  destacar: boolean;
}

interface ClienteCompra {
  cliente_id: string;
  nome: string;
  lid: string | null;
  produtos: ClienteProdutoCompra[];
}

interface FamiliaOption { familia_id: string; nome: string; }
interface FabricanteOption { fabricante_id: string; nome: string; }

// Memoized product row to avoid re-rendering all rows on single toggle
const ProductRow = memo(({ p, onToggle }: { p: ProdutoEstoque; onToggle: (id: string, checked: boolean) => void }) => (
  <TableRow className={p.checked ? "bg-muted/30" : ""}>
    <TableCell>
      <Checkbox checked={p.checked} onCheckedChange={(v) => onToggle(p.produto_id, !!v)} />
    </TableCell>
    <TableCell className="font-medium">{p.nome}</TableCell>
    <TableCell className="text-muted-foreground">{p.familia}</TableCell>
    <TableCell className="text-muted-foreground">{p.fabricante}</TableCell>
    <TableCell className="text-right">R$ {p.preco.toFixed(2)}</TableCell>
    <TableCell className="text-center font-semibold">{p.total_estoque}</TableCell>
  </TableRow>
));
ProductRow.displayName = "ProductRow";

// Helper: fetch LIDs for a list of cliente_ids
async function fetchLids(clienteIds: string[]): Promise<Map<string, string>> {
  const lidMap = new Map<string, string>();
  if (clienteIds.length === 0) return lidMap;

  const { data: telefones } = await supabase
    .from("cliente_telefone")
    .select("cliente_id, lid")
    .in("cliente_id", clienteIds)
    .not("lid", "is", null);

  if (telefones) {
    for (const t of telefones as any[]) {
      if (t.lid) lidMap.set(t.cliente_id, t.lid);
    }
  }
  return lidMap;
}

type SortKey = "nome" | "familia" | "fabricante" | "preco" | "total_estoque" | "valor_total";
type SortDir = "asc" | "desc";

interface WebhookLog {
  integracao_log_id: string;
  created_at: string;
  status: string | null;
  payload: any;
}

interface WebhookProxyRequest {
  webhook_url: string;
  webhook_apikey?: string;
  log_tipo?: string;
  payload: unknown;
}

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const invokeWebhookProxy = async (body: WebhookProxyRequest) => {
  try {
    const { data, error } = await supabase.functions.invoke("webhook-proxy", { body });
    if (error) throw error;
    return data;
  } catch (error: any) {
    const isFetchError =
      error?.name === "FunctionsFetchError" ||
      error?.message?.includes("Failed to send a request to the Edge Function");

    if (!isFetchError) throw error;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw error;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    const responseJson = responseText ? safeJsonParse(responseText) : null;

    if (!response.ok) {
      const errorMessage =
        responseJson && typeof responseJson === "object" && "error" in responseJson
          ? String((responseJson as { error: unknown }).error)
          : responseText || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseJson ?? responseText;
  }
};

const EstoqueRelatorio = () => {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [familias, setFamilias] = useState<FamiliaOption[]>([]);
  const [fabricantes, setFabricantes] = useState<FabricanteOption[]>([]);
  const [search, setSearch] = useState("");
  const [filterFamilia, setFilterFamilia] = useState("all");
  const [filterFabricante, setFilterFabricante] = useState("all");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return format(d, "yyyy-MM-dd");
  });
  const [dataFim, setDataFim] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [clientes, setClientes] = useState<ClienteCompra[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [expandedLogIdx, setExpandedLogIdx] = useState<number | null>(null);
  const [logPage, setLogPage] = useState(0);
  const LOGS_PER_PAGE = 5;
  const [totalLogs, setTotalLogs] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    loadWebhookLogs();
  }, []);

  const loadWebhookLogs = async (page = logPage) => {
    const from = page * LOGS_PER_PAGE;
    const to = from + LOGS_PER_PAGE - 1;

    const [{ count }, { data }] = await Promise.all([
      supabase
        .from("integracao_log")
        .select("integracao_log_id", { count: "exact", head: true })
        .eq("tipo", "webhook_estoque"),
      supabase
        .from("integracao_log")
        .select("integracao_log_id, created_at, status, payload")
        .eq("tipo", "webhook_estoque")
        .order("created_at", { ascending: false })
        .range(from, to),
    ]);

    if (data) setWebhookLogs(data as WebhookLog[]);
    setTotalLogs(count ?? 0);
    setExpandedLogIdx(null);
  };

  const loadData = async () => {
    const [{ data: estoque }, { data: fam }, { data: fab }] = await Promise.all([
      supabase.from("estoque_local").select("produto_id, quantidade_disponivel, produto(nome, descricao, preco, peso_liquido, unidade_medida, familia(familia_id, nome), fabricante(fabricante_id, nome), produto_imagem(url_imagem, ordem))"),
      supabase.from("familia").select("familia_id, nome").eq("ativo", true).order("nome"),
      supabase.from("fabricante").select("fabricante_id, nome").eq("ativo", true).order("nome"),
    ]);

    if (fam) setFamilias(fam);
    if (fab) setFabricantes(fab);

    if (estoque) {
      const map = new Map<string, ProdutoEstoque>();
      for (const e of estoque as any[]) {
        const pid = e.produto_id;
        if (!map.has(pid)) {
          const imagens = e.produto?.produto_imagem || [];
          const imgPrincipal = imagens.length > 0
            ? imagens.sort((a: any, b: any) => a.ordem - b.ordem)[0].url_imagem
            : null;
          map.set(pid, {
            produto_id: pid,
            nome: e.produto?.nome || "—",
            descricao: e.produto?.descricao || null,
            preco: e.produto?.preco || 0,
            peso_liquido: e.produto?.peso_liquido ?? null,
            unidade_medida: e.produto?.unidade_medida || "un",
            familia: e.produto?.familia?.nome || "—",
            fabricante: e.produto?.fabricante?.nome || "—",
            imagem_url: imgPrincipal,
            total_estoque: 0,
            checked: false,
          });
        }
        map.get(pid)!.total_estoque += Number(e.quantidade_disponivel);
      }
      setProdutos(Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    }
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    let result = produtos.filter((p) => {
      const matchSearch = !term || p.nome.toLowerCase().includes(term) || p.produto_id.toLowerCase().includes(term);
      const matchFamilia = filterFamilia === "all" || p.familia === filterFamilia;
      const matchFabricante = filterFabricante === "all" || p.fabricante === filterFabricante;
      return matchSearch && matchFamilia && matchFabricante;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "valor_total") {
        cmp = (a.preco * a.total_estoque) - (b.preco * b.total_estoque);
      } else if (sortKey === "preco" || sortKey === "total_estoque") {
        cmp = a[sortKey] - b[sortKey];
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey], "pt-BR");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [produtos, search, filterFamilia, filterFabricante, sortKey, sortDir]);

  const checkedProducts = useMemo(() => produtos.filter((p) => p.checked), [produtos]);

  const totalValue = useMemo(() => filtered.reduce((sum, p) => sum + p.preco * p.total_estoque, 0), [filtered]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => d === "asc" ? "desc" : "asc");
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const allFilteredChecked = useMemo(
    () => filtered.length > 0 && filtered.every((p) => p.checked),
    [filtered]
  );

  const toggleAll = useCallback((checked: boolean) => {
    const filteredIds = new Set(filtered.map((p) => p.produto_id));
    setProdutos((prev) => prev.map((p) => filteredIds.has(p.produto_id) ? { ...p, checked } : p));
  }, [filtered]);

  const toggleProduct = useCallback((produto_id: string, checked: boolean) => {
    setProdutos((prev) => prev.map((p) => p.produto_id === produto_id ? { ...p, checked } : p));
  }, []);

  const loadClientes = async () => {
    if (checkedProducts.length === 0) {
      toast({ title: "Selecione ao menos um produto", variant: "destructive" });
      return;
    }
    setLoadingClientes(true);

    const prodIds = checkedProducts.map((p) => p.produto_id);
    const prodInfoMap = new Map(checkedProducts.map((p) => [p.produto_id, p]));

    const [{ data: pedidoItems }, { data: produtosDb }] = await Promise.all([
      supabase
        .from("pedido_item")
        .select("produto_id, quantidade, preco_unitario, pedido:pedido_id(pedido_id, data, cliente_id, status, cliente:cliente_id(cliente_id, nome, clientewhats_id))")
        .in("produto_id", prodIds),
      supabase
        .from("produto")
        .select("produto_id, peso_liquido, unidade_medida, destacar")
        .in("produto_id", prodIds),
    ]);

    if (!pedidoItems) {
      setClientes([]);
      setLoadingClientes(false);
      return;
    }

    const pesoMap = new Map<string, { peso: number | null; unidade: string; destacar: boolean }>();
    if (produtosDb) {
      for (const pr of produtosDb as any[]) {
        pesoMap.set(pr.produto_id, { peso: pr.peso_liquido, unidade: pr.unidade_medida || "un", destacar: pr.destacar ?? false });
      }
    }

    const inicio = new Date(dataInicio + "T00:00:00");
    const fim = new Date(dataFim + "T23:59:59");
    const validStatuses = new Set(["separacao", "aguardando_pagamento", "pago", "enviado", "entregue"]);

    // Group by cliente
    const clienteMap = new Map<string, ClienteCompra>();

    for (const item of pedidoItems as any[]) {
      const pedido = item.pedido;
      if (!pedido || !pedido.cliente) continue;
      const pedidoDate = new Date(pedido.data);
      if (pedidoDate < inicio || pedidoDate > fim) continue;
      if (!validStatuses.has(pedido.status)) continue;

      const cid = pedido.cliente.cliente_id;
      if (!clienteMap.has(cid)) {
        clienteMap.set(cid, {
          cliente_id: cid,
          nome: pedido.cliente.nome,
          lid: null,
          produtos: [],
        });
      }

      const prodInfo = prodInfoMap.get(item.produto_id);
      const pesoInfo = pesoMap.get(item.produto_id);
      const cliente = clienteMap.get(cid)!;

      // Deduplicate: if product already exists for this client, sum quantity
      const existing = cliente.produtos.find((p) => p.produto_id === item.produto_id);
      if (existing) {
        existing.quantidade += Number(item.quantidade);
      } else {
        cliente.produtos.push({
          produto_id: item.produto_id,
          produto_nome: prodInfo?.nome || "—",
          peso: pesoInfo?.peso ?? null,
          unidade_medida: pesoInfo?.unidade ?? "un",
          valor: Number(item.preco_unitario),
          quantidade: Number(item.quantidade),
          data_compra: pedido.data,
          destacar: pesoInfo?.destacar ?? false,
        });
      }
    }

    const results = Array.from(clienteMap.values());

    // Fetch LIDs
    const uniqueClienteIds = results.map((r) => r.cliente_id);
    const lidMap = await fetchLids(uniqueClienteIds);
    for (const r of results) {
      r.lid = lidMap.get(r.cliente_id) || null;
    }

    setClientes(results);
    setLoadingClientes(false);
  };

  const sendWebhook = async () => {
    const { data: configs } = await supabase
      .from("configuracao")
      .select("chave, valor")
      .in("chave", ["webhook_estoque_url", "webhook_estoque_apikey"])
      .is("user_id", null);

    const configMap: Record<string, string> = {};
    if (configs) configs.forEach((c: any) => { configMap[c.chave] = c.valor || ""; });

    const webhookUrl = configMap["webhook_estoque_url"];
    const webhookApikey = configMap["webhook_estoque_apikey"];

    if (!webhookUrl) {
      toast({ title: "Webhook não configurado", description: "Configure a URL do webhook de estoque em Configurações.", variant: "destructive" });
      return;
    }

    setSending(true);

    const payload = {
      tipo: "relatorio_estoque",
      periodo: { inicio: dataInicio, fim: dataFim },
      clientes: clientes
        .filter((c) => c.nome.toLowerCase() !== "consumidor final")
        .map((c) => ({
          cliente_id: c.cliente_id,
          nome: c.nome,
          ...(c.lid ? { lid: c.lid } : {}),
          produtos: c.produtos.map((pr) => ({
            produto_id: pr.produto_id,
            nome: pr.produto_nome,
            peso: pr.peso,
            unidade_medida: pr.unidade_medida,
            valor: pr.valor,
            quantidade: pr.quantidade,
            destacar: pr.destacar,
          })),
        })),
    };

    try {
      const response = await invokeWebhookProxy({
        webhook_url: webhookUrl,
        webhook_apikey: webhookApikey,
        log_tipo: "webhook_estoque",
        payload,
      });

      if (response && typeof response === "object" && "error" in response && response.error) {
        throw new Error(String(response.error));
      }

      toast({ title: "Relatório enviado com sucesso!" });
      setPreviewOpen(false);
      setLogPage(0);
      loadWebhookLogs(0);
    } catch (err: any) {
      console.error("Erro ao enviar relatório de estoque", err);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterFamilia} onValueChange={setFilterFamilia}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Família" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Famílias</SelectItem>
              {familias.map((f) => <SelectItem key={f.familia_id} value={f.nome}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterFabricante} onValueChange={setFilterFabricante}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Fabricante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Fabricantes</SelectItem>
              {fabricantes.map((f) => <SelectItem key={f.fabricante_id} value={f.nome}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => { if (checkedProducts.length === 0) { toast({ title: "Selecione ao menos um produto", variant: "destructive" }); return; } setPreviewOpen(true); }} disabled={checkedProducts.length === 0} className="gap-2 ml-auto">
            <Send className="h-4 w-4" />
            Campanha Estoque
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">
          {checkedProducts.length} selecionado(s) · {filtered.length} exibido(s)
        </span>
        <span className="text-sm font-semibold">
          Valor Total: R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Products table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredChecked}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
              </TableHead>
              <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("nome")}>
                <span className="flex items-center">Produto <SortIcon col="nome" /></span>
              </TableHead>
              <TableHead className="whitespace-nowrap">Peso</TableHead>
              <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("familia")}>
                <span className="flex items-center">Família <SortIcon col="familia" /></span>
              </TableHead>
              <TableHead className="whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("fabricante")}>
                <span className="flex items-center">Fabricante <SortIcon col="fabricante" /></span>
              </TableHead>
              <TableHead className="text-right whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("preco")}>
                <span className="flex items-center justify-end">Preço <SortIcon col="preco" /></span>
              </TableHead>
              <TableHead className="text-center whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("total_estoque")}>
                <span className="flex items-center justify-center">Estoque <SortIcon col="total_estoque" /></span>
              </TableHead>
              <TableHead className="text-right whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort("valor_total")}>
                <span className="flex items-center justify-end">Valor Total <SortIcon col="valor_total" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.produto_id} className={p.checked ? "bg-muted/30" : ""}>
                <TableCell>
                  <Checkbox checked={p.checked} onCheckedChange={(v) => toggleProduct(p.produto_id, !!v)} />
                </TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-muted-foreground">{p.familia}</TableCell>
                <TableCell className="text-muted-foreground">{p.fabricante}</TableCell>
                <TableCell className="text-right">R$ {p.preco.toFixed(2)}</TableCell>
                <TableCell className="text-center font-semibold">{p.total_estoque}</TableCell>
                <TableCell className="text-right font-medium">R$ {(p.preco * p.total_estoque).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Preview / Send Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campanha Estoque</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date filters + load button */}
            <div className="flex flex-col sm:flex-row items-end gap-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[150px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Fim</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" />
                </div>
              </div>
              <Button onClick={loadClientes} disabled={loadingClientes} variant="secondary" className="gap-2">
                {loadingClientes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loadingClientes ? "Carregando..." : "Buscar Clientes"}
              </Button>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Produtos Selecionados ({checkedProducts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {checkedProducts.map((p) => (
                    <Badge key={p.produto_id} variant="secondary">{p.nome}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Clientes que compraram no período ({clientes.length} cliente(s))
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum cliente encontrado no período {dataInicio} a {dataFim}.</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {clientes.map((c) => (
                      <div key={c.cliente_id} className="border rounded-lg">
                        <div className="px-3 py-2 bg-muted/50 border-b flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{c.nome}</span>
                          {c.lid && <Badge variant="outline" className="font-mono text-[10px]">LID: {c.lid}</Badge>}
                          <span className="text-[10px] text-muted-foreground ml-auto">{c.cliente_id}</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
              <TableHead className="text-xs">Produto</TableHead>
                              <TableHead className="text-xs text-center">Peso</TableHead>
                              <TableHead className="text-xs text-center">Unid.</TableHead>
                              <TableHead className="text-xs text-right">Valor</TableHead>
                              <TableHead className="text-xs text-center">Qtd</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {c.produtos.map((pr, pi) => (
                              <TableRow key={pi}>
                                <TableCell className="text-xs font-medium">{pr.produto_nome}</TableCell>
                                <TableCell className="text-xs text-center">{pr.peso != null ? pr.peso : "—"}</TableCell>
                                <TableCell className="text-xs text-center">{pr.unidade_medida}</TableCell>
                                <TableCell className="text-xs text-right">R$ {pr.valor.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-center">{pr.quantidade}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
            <Button onClick={sendWebhook} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando..." : "Enviar via Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico de Envios */}
      {(webhookLogs.length > 0 || logPage > 0) && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Histórico de Envios</CardTitle>
            <span className="text-xs text-muted-foreground">{totalLogs} registro(s)</span>
          </CardHeader>
          <CardContent className="space-y-1">
            {webhookLogs.map((log, idx) => {
              const isExpanded = expandedLogIdx === idx;
              const clientesLog = log.payload?.clientes || [];
              return (
                <div key={log.integracao_log_id} className="border rounded">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedLogIdx(isExpanded ? null : idx)}
                  >
                    <span className="font-medium">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {clientesLog.length} cliente(s)
                      </span>
                      <Badge variant={log.status === "sucesso" ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                        {log.status || "—"}
                      </Badge>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-2 space-y-2">
                      {clientesLog.map((c: any, ci: number) => (
                        <div key={ci} className="border rounded bg-muted/30">
                          <div className="px-2 py-1.5 text-xs font-semibold border-b bg-muted/50 flex items-center gap-2">
                            <span>{c.nome}</span>
                            {c.lid && <span className="font-mono text-muted-foreground">LID: {c.lid}</span>}
                          </div>
                          <div className="divide-y text-xs max-h-40 overflow-y-auto">
                            {(c.produtos || []).map((pr: any, pi: number) => (
                              <div key={pi} className="px-2 py-1.5 flex justify-between items-center gap-2">
                                <span className="font-medium truncate">{pr.nome || pr.produto_nome || "—"}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-muted-foreground">Qtd: {pr.quantidade}</span>
                                  <span className="text-muted-foreground">R$ {Number(pr.valor).toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Pagination */}
            {totalLogs > LOGS_PER_PAGE && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logPage === 0}
                  onClick={() => { const p = logPage - 1; setLogPage(p); loadWebhookLogs(p); }}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {logPage + 1} de {Math.ceil(totalLogs / LOGS_PER_PAGE)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(logPage + 1) * LOGS_PER_PAGE >= totalLogs}
                  onClick={() => { const p = logPage + 1; setLogPage(p); loadWebhookLogs(p); }}
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EstoqueRelatorio;
