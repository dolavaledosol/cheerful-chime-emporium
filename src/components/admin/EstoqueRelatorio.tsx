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
import { Search, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ProdutoEstoque {
  produto_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  familia: string;
  fabricante: string;
  imagem_url: string | null;
  total_estoque: number;
  checked: boolean;
}

interface ClienteCompra {
  cliente_id: string;
  nome: string;
  lid: string | null;
  data_compra: string;
  quantidade: number;
  produto_id: string;
  produto_nome: string;
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
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: estoque }, { data: fam }, { data: fab }] = await Promise.all([
      supabase.from("estoque_local").select("produto_id, quantidade_disponivel, produto(nome, descricao, preco, familia(familia_id, nome), fabricante(fabricante_id, nome), produto_imagem(url_imagem, ordem))"),
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
    return produtos.filter((p) => {
      const matchSearch = !term || p.nome.toLowerCase().includes(term) || p.produto_id.toLowerCase().includes(term);
      const matchFamilia = filterFamilia === "all" || p.familia === filterFamilia;
      const matchFabricante = filterFabricante === "all" || p.fabricante === filterFabricante;
      return matchSearch && matchFamilia && matchFabricante;
    });
  }, [produtos, search, filterFamilia, filterFabricante]);

  const checkedProducts = useMemo(() => produtos.filter((p) => p.checked), [produtos]);

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
    // Pre-build lookup map to avoid .find() inside loop
    const prodNomeMap = new Map(checkedProducts.map((p) => [p.produto_id, p.nome]));

    const { data: pedidoItems } = await supabase
      .from("pedido_item")
      .select("produto_id, quantidade, pedido:pedido_id(pedido_id, data, cliente_id, status, cliente:cliente_id(cliente_id, nome, clientewhats_id))")
      .in("produto_id", prodIds);

    if (!pedidoItems) {
      setClientes([]);
      setLoadingClientes(false);
      setPreviewOpen(true);
      return;
    }

    const inicio = new Date(dataInicio + "T00:00:00");
    const fim = new Date(dataFim + "T23:59:59");
    const validStatuses = new Set(["separacao", "aguardando_pagamento", "pago", "enviado", "entregue"]);

    const results: ClienteCompra[] = [];

    for (const item of pedidoItems as any[]) {
      const pedido = item.pedido;
      if (!pedido || !pedido.cliente) continue;
      const pedidoDate = new Date(pedido.data);
      if (pedidoDate < inicio || pedidoDate > fim) continue;
      if (!validStatuses.has(pedido.status)) continue;

      results.push({
        cliente_id: pedido.cliente.cliente_id,
        nome: pedido.cliente.nome,
        lid: null,
        data_compra: pedido.data,
        quantidade: Number(item.quantidade),
        produto_id: item.produto_id,
        produto_nome: prodNomeMap.get(item.produto_id) || "—",
      });
    }

    // Fetch LIDs (deduplicated logic)
    const uniqueClienteIds = [...new Set(results.map((r) => r.cliente_id))];
    const lidMap = await fetchLids(uniqueClienteIds);
    for (const r of results) {
      r.lid = lidMap.get(r.cliente_id) || null;
    }

    setClientes(results);
    setLoadingClientes(false);
    setPreviewOpen(true);
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
      produtos: checkedProducts.map((p) => ({
        produto_id: p.produto_id,
        nome: p.nome,
        valor: p.preco,
        descricao: p.descricao,
        familia: p.familia,
        fabricante: p.fabricante,
        imagem_url: p.imagem_url,
      })),
      clientes: clientes.map((c) => ({
        cliente_id: c.cliente_id,
        nome: c.nome,
        lid: c.lid,
        data_compra: c.data_compra,
        quantidade: c.quantidade,
        produto_id: c.produto_id,
        produto_nome: c.produto_nome,
      })),
    };

    try {
      const { error } = await supabase.functions.invoke("webhook-proxy", {
        body: {
          webhook_url: webhookUrl,
          webhook_apikey: webhookApikey,
          log_tipo: "webhook_estoque",
          payload,
        },
      });

      if (error) throw error;

      toast({ title: "Relatório enviado com sucesso!" });
      setPreviewOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterFamilia} onValueChange={setFilterFamilia}>
          <SelectTrigger><SelectValue placeholder="Família" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Famílias</SelectItem>
            {familias.map((f) => <SelectItem key={f.familia_id} value={f.nome}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFabricante} onValueChange={setFilterFabricante}>
          <SelectTrigger><SelectValue placeholder="Fabricante" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Fabricantes</SelectItem>
            {fabricantes.map((f) => <SelectItem key={f.fabricante_id} value={f.nome}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Label className="text-xs">Data Início</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Data Fim</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {checkedProducts.length} produto(s) selecionado(s) de {filtered.length} exibido(s)
        </span>
        <Button onClick={loadClientes} disabled={checkedProducts.length === 0 || loadingClientes} className="gap-2">
          {loadingClientes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loadingClientes ? "Carregando..." : "Preparar Envio"}
        </Button>
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
              <TableHead className="whitespace-nowrap">Produto</TableHead>
              <TableHead className="whitespace-nowrap">Família</TableHead>
              <TableHead className="whitespace-nowrap">Fabricante</TableHead>
              <TableHead className="text-right whitespace-nowrap">Preço</TableHead>
              <TableHead className="text-center whitespace-nowrap">Estoque Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
            ) : filtered.map((p) => (
              <ProductRow key={p.produto_id} p={p} onToggle={toggleProduct} />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Preview / Send Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização do Envio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
                  Clientes que compraram no período ({clientes.length} registros)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum cliente encontrado no período {dataInicio} a {dataFim}.</p>
                ) : (
                  <div className="border rounded-lg overflow-auto max-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>LID</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead>Data Compra</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientes.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">{c.lid || "—"}</TableCell>
                            <TableCell>{c.produto_nome}</TableCell>
                            <TableCell className="text-center">{c.quantidade}</TableCell>
                            <TableCell>{format(new Date(c.data_compra), "dd/MM/yyyy")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
    </div>
  );
};

export default EstoqueRelatorio;
