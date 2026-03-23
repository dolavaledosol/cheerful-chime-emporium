import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Send, Loader2, Megaphone, Plus, Trash2, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ClienteCampanha {
  cliente_id: string;
  nome: string;
  lid: string | null;
}

interface ProdutoCampanha {
  produto_id: string;
  nome: string;
  peso: number | null;
  unidade_medida: string;
  familia: string | null;
  fabricante: string | null;
  preco: number;
  total_estoque: number;
  url_imagem: string | null;
  checked: boolean;
}

interface FamiliaOption { familia_id: string; nome: string; }

const safeJsonParse = (value: string) => {
  try { return JSON.parse(value); } catch { return null; }
};

const invokeWebhookProxy = async (body: {
  webhook_url: string;
  webhook_apikey?: string;
  log_tipo?: string;
  payload: unknown;
}) => {
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
      const errorMessage = responseJson?.error ? String(responseJson.error) : responseText || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }
    return responseJson ?? responseText;
  }
};

// Desktop product row
const ProductRow = memo(({ p, onToggle }: { p: ProdutoCampanha; onToggle: (id: string, checked: boolean) => void }) => (
  <TableRow className={p.checked ? "bg-muted/30" : ""}>
    <TableCell><Checkbox checked={p.checked} onCheckedChange={(v) => onToggle(p.produto_id, !!v)} /></TableCell>
    <TableCell className="font-medium">{p.nome}</TableCell>
    <TableCell className="text-muted-foreground whitespace-nowrap">{p.peso != null ? `${p.peso} ${p.unidade_medida}` : "—"}</TableCell>
    <TableCell className="text-muted-foreground">{p.familia || "—"}</TableCell>
    <TableCell className="text-muted-foreground">{p.fabricante || "—"}</TableCell>
    <TableCell className="text-right">R$ {p.preco.toFixed(2)}</TableCell>
    <TableCell className="text-center font-semibold">{p.total_estoque}</TableCell>
    <TableCell className="text-right font-medium">R$ {(p.preco * p.total_estoque).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
  </TableRow>
));
ProductRow.displayName = "ProductRow";

// Mobile product card
const ProductCard = memo(({ p, onToggle }: { p: ProdutoCampanha; onToggle: (id: string, checked: boolean) => void }) => (
  <button
    onClick={() => onToggle(p.produto_id, !p.checked)}
    className={`w-full text-left rounded-xl border p-3 space-y-1 transition-colors active:scale-[0.98] ${p.checked ? "border-primary/40 bg-primary/5" : "bg-card"}`}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="font-medium text-sm leading-tight flex-1">{p.nome}</p>
      <Checkbox checked={p.checked} onCheckedChange={(v) => onToggle(p.produto_id, !!v)} className="shrink-0 mt-0.5" />
    </div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {p.fabricante && <span>{p.fabricante}</span>}
      {p.familia && <span>{p.familia}</span>}
      <span>R$ {p.preco.toFixed(2)}</span>
      {p.peso != null && <span>{p.peso} {p.unidade_medida}</span>}
      <span>Est: {p.total_estoque}</span>
    </div>
  </button>
));
ProductCard.displayName = "ProductCard";

const CampanhaRelatorio = ({ inline = false }: { inline?: boolean }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("clientes");
  const isMobile = useIsMobile();
  

  const [clientes, setClientes] = useState<ClienteCampanha[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const [produtos, setProdutos] = useState<ProdutoCampanha[]>([]);
  const [fabricantes, setFabricantes] = useState<FabricanteOption[]>([]);
  const [familias, setFamilias] = useState<FamiliaOption[]>([]);
  const [searchProd, setSearchProd] = useState("");
  const [filterFamilia, setFilterFamilia] = useState("all");
  const [filterFabricante, setFilterFabricante] = useState("all");

  const [urls, setUrls] = useState<string[]>([""]);
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const openDialog = () => {
    setDialogOpen(true);
    setActiveTab("clientes");
    loadAll();
  };

  const loadAll = async () => {
    setLoadingClientes(true);

    const [{ data: clientesDb }, { data: clienteWhatsDb }, { data: telefones }] = await Promise.all([
      supabase.from("cliente").select("cliente_id, nome").eq("ativo", true).order("nome"),
      supabase.from("clientewhats").select("clientewhats_id, nome, lid, cliente_id"),
      supabase.from("cliente_telefone").select("cliente_id, lid").not("lid", "is", null),
    ]);

    const lidSet = new Set<string>();
    const result: ClienteCampanha[] = [];

    if (clienteWhatsDb) {
      for (const cw of clienteWhatsDb as any[]) {
        if (cw.lid && !lidSet.has(cw.lid)) {
          lidSet.add(cw.lid);
          result.push({ cliente_id: cw.cliente_id || `cw_${cw.clientewhats_id}`, nome: cw.nome || "—", lid: cw.lid });
        }
      }
    }

    const telLidMap = new Map<string, string>();
    if (telefones) {
      for (const t of telefones as any[]) {
        if (t.lid && !telLidMap.has(t.cliente_id)) telLidMap.set(t.cliente_id, t.lid);
      }
    }

    if (clientesDb) {
      for (const c of clientesDb as any[]) {
        const lid = telLidMap.get(c.cliente_id) || null;
        if (lid) {
          if (!lidSet.has(lid)) { lidSet.add(lid); result.push({ cliente_id: c.cliente_id, nome: c.nome, lid }); }
        } else {
          result.push({ cliente_id: c.cliente_id, nome: c.nome, lid: null });
        }
      }
    }

    setClientes(result);
    setLoadingClientes(false);

    const [{ data: prods }, { data: fab }, { data: fam }, { data: estoqueData }] = await Promise.all([
      supabase.from("produto").select("produto_id, nome, preco, peso_liquido, unidade_medida, fabricante(nome), familia(nome), produto_imagem(url_imagem, ordem)").eq("ativo", true).order("nome"),
      supabase.from("fabricante").select("fabricante_id, nome").eq("ativo", true).order("nome"),
      supabase.from("familia").select("familia_id, nome").eq("ativo", true).order("nome"),
      supabase.from("estoque_local").select("produto_id, quantidade_disponivel"),
    ]);

    if (fab) setFabricantes(fab);
    if (fam) setFamilias(fam);

    // Build estoque map
    const estoqueMap = new Map<string, number>();
    if (estoqueData) {
      for (const e of estoqueData as any[]) {
        estoqueMap.set(e.produto_id, (estoqueMap.get(e.produto_id) || 0) + Number(e.quantidade_disponivel));
      }
    }

    if (prods) {
      setProdutos((prods as any[]).map((p) => {
        const imagens = p.produto_imagem || [];
        const imgPrincipal = imagens.length > 0 ? imagens.sort((a: any, b: any) => a.ordem - b.ordem)[0].url_imagem : null;
        return {
          produto_id: p.produto_id, nome: p.nome, peso: p.peso_liquido,
          unidade_medida: p.unidade_medida || "un", familia: p.familia?.nome || null,
          fabricante: p.fabricante?.nome || null,
          preco: p.preco || 0, total_estoque: estoqueMap.get(p.produto_id) || 0,
          url_imagem: imgPrincipal, checked: false,
        };
      }));
    }
  };

  const filteredProdutos = useMemo(() => {
    const term = searchProd.toLowerCase();
    return produtos.filter((p) => {
      const matchSearch = !term || p.nome.toLowerCase().includes(term);
      const matchFamilia = filterFamilia === "all" || p.familia === filterFamilia;
      const matchFabricante = filterFabricante === "all" || p.fabricante === filterFabricante;
      return matchSearch && matchFamilia && matchFabricante;
    });
  }, [produtos, searchProd, filterFamilia, filterFabricante]);

  const checkedProducts = useMemo(() => produtos.filter((p) => p.checked), [produtos]);

  const toggleProduct = useCallback((id: string, checked: boolean) => {
    setProdutos((prev) => prev.map((p) => p.produto_id === id ? { ...p, checked } : p));
  }, []);

  const allFilteredChecked = useMemo(
    () => filteredProdutos.length > 0 && filteredProdutos.every((p) => p.checked),
    [filteredProdutos]
  );

  const toggleAll = useCallback((checked: boolean) => {
    const ids = new Set(filteredProdutos.map((p) => p.produto_id));
    setProdutos((prev) => prev.map((p) => ids.has(p.produto_id) ? { ...p, checked } : p));
  }, [filteredProdutos]);

  const addUrl = () => setUrls([...urls, ""]);
  const removeUrl = (idx: number) => setUrls(urls.filter((_, i) => i !== idx));
  const updateUrl = (idx: number, val: string) => {
    const updated = [...urls];
    updated[idx] = val;
    setUrls(updated);
  };

  const clientesComLid = useMemo(() => clientes.filter((c) => c.lid), [clientes]);

  const sendWebhook = async () => {
    const { data: configs } = await supabase
      .from("configuracao").select("chave, valor")
      .in("chave", ["webhook_campanha_url", "webhook_campanha_apikey"])
      .is("user_id", null);

    const configMap: Record<string, string> = {};
    if (configs) configs.forEach((c: any) => { configMap[c.chave] = c.valor || ""; });

    const webhookUrl = configMap["webhook_campanha_url"];
    const webhookApikey = configMap["webhook_campanha_apikey"];

    if (!webhookUrl) {
      toast({ title: "Webhook não configurado", description: "Configure a URL do webhook de campanha em Configurações.", variant: "destructive" });
      return;
    }
    if (clientesComLid.length === 0) {
      toast({ title: "Nenhum cliente com LID", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const validUrls = urls.filter((u) => u.trim().length > 0);
      const payload = {
        tipo: "campanha",
        clientes: clientesComLid.map((c) => ({ nome: c.nome, lid: c.lid })),
        produtos: checkedProducts.map((p) => ({
          produto_id: p.produto_id, nome: p.nome, peso: p.peso,
          unidade_medida: p.unidade_medida, fabricante: p.fabricante,
          preco: p.preco, url_imagem: p.url_imagem,
        })),
        urls: validUrls,
        mensagem: mensagem.trim() || null,
      };

      const response = await invokeWebhookProxy({
        webhook_url: webhookUrl, webhook_apikey: webhookApikey,
        log_tipo: "webhook_campanha", payload,
      });

      if (response && typeof response === "object" && "error" in response && response.error) {
        throw new Error(String(response.error));
      }

      toast({ title: "Campanha enviada com sucesso!" });
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Erro ao enviar campanha", err);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Auto-load when inline
  useEffect(() => {
    if (inline) loadAll();
  }, [inline]);

  const tabsContent = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="clientes" className="text-xs sm:text-sm">
          Clientes ({clientesComLid.length})
        </TabsTrigger>
        <TabsTrigger value="produtos" className="text-xs sm:text-sm">
          Produtos ({checkedProducts.length})
        </TabsTrigger>
        <TabsTrigger value="mensagem" className="text-xs sm:text-sm">
          <MessageSquare className="h-3 w-3 mr-1" />
          Mensagem
        </TabsTrigger>
        <TabsTrigger value="urls" className="text-xs sm:text-sm">
          Vídeos ({urls.filter((u) => u.trim()).length})
        </TabsTrigger>
      </TabsList>

      {/* Clientes tab */}
      <TabsContent value="clientes" className="flex-1 overflow-y-auto mt-4">
        {loadingClientes ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {clientesComLid.length} cliente(s) com LID (de {clientes.length} total)
            </p>
            {isMobile ? (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {clientesComLid.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">Nenhum cliente com LID</p>
                ) : clientesComLid.map((c, idx) => (
                  <div key={`${c.cliente_id}-${idx}`} className="rounded-xl border bg-card p-3 flex justify-between items-center">
                    <p className="font-medium text-sm">{c.nome}</p>
                    <span className="text-xs text-muted-foreground font-mono">{c.lid}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>LID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesComLid.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Nenhum cliente com LID encontrado</TableCell></TableRow>
                    ) : clientesComLid.map((c, idx) => (
                      <TableRow key={`${c.cliente_id}-${idx}`}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{c.lid}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </TabsContent>

      {/* Produtos tab */}
      <TabsContent value="produtos" className="flex-1 overflow-y-auto mt-4">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={searchProd} onChange={(e) => setSearchProd(e.target.value)} className="pl-10" />
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

          <div className="flex items-center gap-2">
            <Checkbox checked={allFilteredChecked} onCheckedChange={(v) => toggleAll(!!v)} />
            <span className="text-xs text-muted-foreground">Selecionar todos ({filteredProdutos.length})</span>
          </div>

          {isMobile ? (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {filteredProdutos.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">Nenhum produto encontrado</p>
              ) : filteredProdutos.map((p) => (
                <ProductCard key={p.produto_id} p={p} onToggle={toggleProduct} />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allFilteredChecked} onCheckedChange={(v) => toggleAll(!!v)} />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-center">Peso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProdutos.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
                  ) : filteredProdutos.map((p) => (
                    <ProductRow key={p.produto_id} p={p} onToggle={toggleProduct} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Mensagem tab */}
      <TabsContent value="mensagem" className="flex-1 overflow-y-auto mt-4">
        <div className="space-y-3">
          <Label>Mensagem da campanha</Label>
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite a mensagem que será enviada junto com a campanha..."
            className="min-h-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            {mensagem.trim().length > 0 ? `${mensagem.length} caracteres` : "Nenhuma mensagem definida"}
          </p>
        </div>
      </TabsContent>

      {/* URLs tab */}
      <TabsContent value="urls" className="flex-1 overflow-y-auto mt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Links de vídeo</Label>
            <Button type="button" variant="ghost" size="sm" className="gap-1 h-7" onClick={addUrl}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>
          {urls.map((url, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => updateUrl(idx, e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 h-11"
              />
              {urls.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => removeUrl(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );

  const sendButton = (
    <div className="flex justify-end gap-2 mt-4">
      {!inline && <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>}
      <Button onClick={sendWebhook} disabled={sending || clientesComLid.length === 0} className="gap-2">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? "Enviando..." : "Enviar Campanha"}
      </Button>
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-4">
        {tabsContent}
        {sendButton}
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog} size={isMobile ? "icon" : "default"} className="gap-2 shrink-0">
        <Megaphone className="h-4 w-4" />
        {!isMobile && "Campanha"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" /> Nova Campanha
            </DialogTitle>
          </DialogHeader>
          {tabsContent}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={sendWebhook} disabled={sending || clientesComLid.length === 0} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando..." : "Enviar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CampanhaRelatorio;
