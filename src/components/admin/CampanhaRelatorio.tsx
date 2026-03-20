import { useState, useMemo, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Send, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";

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
  fabricante: string | null;
  preco: number;
  url_imagem: string | null;
  checked: boolean;
}

interface FabricanteOption { fabricante_id: string; nome: string; }

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

const ProductRow = memo(({ p, onToggle }: { p: ProdutoCampanha; onToggle: (id: string, checked: boolean) => void }) => (
  <TableRow className={p.checked ? "bg-muted/30" : ""}>
    <TableCell><Checkbox checked={p.checked} onCheckedChange={(v) => onToggle(p.produto_id, !!v)} /></TableCell>
    <TableCell className="font-medium">{p.nome}</TableCell>
    <TableCell className="text-muted-foreground">{p.fabricante || "—"}</TableCell>
    <TableCell className="text-right">R$ {p.preco.toFixed(2)}</TableCell>
    <TableCell className="text-center">{p.peso ?? "—"} {p.unidade_medida}</TableCell>
  </TableRow>
));
ProductRow.displayName = "ProductRow";

const CampanhaRelatorio = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("clientes");

  // Clients
  const [clientes, setClientes] = useState<ClienteCampanha[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // Products
  const [produtos, setProdutos] = useState<ProdutoCampanha[]>([]);
  const [fabricantes, setFabricantes] = useState<FabricanteOption[]>([]);
  const [searchProd, setSearchProd] = useState("");
  const [filterFabricante, setFilterFabricante] = useState("all");

  // URLs
  const [urls, setUrls] = useState<string[]>([""]);

  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const openDialog = () => {
    setDialogOpen(true);
    setActiveTab("clientes");
    loadAll();
  };

  const loadAll = async () => {
    setLoadingClientes(true);

    // Load clients from both tables, deduplicate by lid
    const [{ data: clientesDb }, { data: clienteWhatsDb }, { data: telefones }] = await Promise.all([
      supabase.from("cliente").select("cliente_id, nome").eq("ativo", true).order("nome"),
      supabase.from("clientewhats").select("clientewhats_id, nome, lid, cliente_id"),
      supabase.from("cliente_telefone").select("cliente_id, lid").not("lid", "is", null),
    ]);

    const lidSet = new Set<string>();
    const result: ClienteCampanha[] = [];

    // From clientewhats first (they have lid directly)
    if (clienteWhatsDb) {
      for (const cw of clienteWhatsDb as any[]) {
        if (cw.lid && !lidSet.has(cw.lid)) {
          lidSet.add(cw.lid);
          result.push({
            cliente_id: cw.cliente_id || `cw_${cw.clientewhats_id}`,
            nome: cw.nome || "—",
            lid: cw.lid,
          });
        }
      }
    }

    // From cliente_telefone (lid associated to clientes)
    const telLidMap = new Map<string, string>();
    if (telefones) {
      for (const t of telefones as any[]) {
        if (t.lid && !telLidMap.has(t.cliente_id)) {
          telLidMap.set(t.cliente_id, t.lid);
        }
      }
    }

    // From clientes table
    if (clientesDb) {
      for (const c of clientesDb as any[]) {
        const lid = telLidMap.get(c.cliente_id) || null;
        if (lid) {
          if (!lidSet.has(lid)) {
            lidSet.add(lid);
            result.push({ cliente_id: c.cliente_id, nome: c.nome, lid });
          }
        } else {
          // Client without lid - still include
          result.push({ cliente_id: c.cliente_id, nome: c.nome, lid: null });
        }
      }
    }

    setClientes(result);
    setLoadingClientes(false);

    // Load products
    const [{ data: prods }, { data: fam }, { data: fab }] = await Promise.all([
      supabase.from("produto").select("produto_id, nome, preco, peso_liquido, unidade_medida, fabricante(nome), produto_imagem(url_imagem, ordem)").eq("ativo", true).order("nome"),
      supabase.from("familia").select("familia_id, nome").eq("ativo", true).order("nome"),
      supabase.from("fabricante").select("fabricante_id, nome").eq("ativo", true).order("nome"),
    ]);

    if (fam) setFamilias(fam);
    if (fab) setFabricantes(fab);

    if (prods) {
      setProdutos((prods as any[]).map((p) => {
        const imagens = p.produto_imagem || [];
        const imgPrincipal = imagens.length > 0 ? imagens.sort((a: any, b: any) => a.ordem - b.ordem)[0].url_imagem : null;
        return {
          produto_id: p.produto_id,
          nome: p.nome,
          peso: p.peso_liquido,
          unidade_medida: p.unidade_medida || "un",
          fabricante: p.fabricante?.nome || null,
          preco: p.preco || 0,
          url_imagem: imgPrincipal,
          checked: false,
        };
      }));
    }
  };

  const filteredProdutos = useMemo(() => {
    const term = searchProd.toLowerCase();
    return produtos.filter((p) => {
      const matchSearch = !term || p.nome.toLowerCase().includes(term);
      const matchFabricante = filterFabricante === "all" || p.fabricante === filterFabricante;
      return matchSearch && matchFabricante;
    });
  }, [produtos, searchProd, filterFabricante]);

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
      .from("configuracao")
      .select("chave, valor")
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
        clientes: clientesComLid.map((c) => ({
          nome: c.nome,
          lid: c.lid,
        })),
        produtos: checkedProducts.map((p) => ({
          produto_id: p.produto_id,
          nome: p.nome,
          peso: p.peso,
          unidade_medida: p.unidade_medida,
          fabricante: p.fabricante,
          preco: p.preco,
          url_imagem: p.url_imagem,
        })),
        urls: validUrls,
      };

      const response = await invokeWebhookProxy({
        webhook_url: webhookUrl,
        webhook_apikey: webhookApikey,
        log_tipo: "webhook_campanha",
        payload,
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

  return (
    <>
      <Button variant="outline" onClick={openDialog} className="gap-2 h-9">
        <Megaphone className="h-4 w-4" />
        Campanha
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" /> Nova Campanha
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clientes">
                Clientes ({clientesComLid.length})
              </TabsTrigger>
              <TabsTrigger value="produtos">
                Produtos ({checkedProducts.length})
              </TabsTrigger>
              <TabsTrigger value="urls">
                Vídeos ({urls.filter((u) => u.trim()).length})
              </TabsTrigger>
            </TabsList>

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
                </div>
              )}
            </TabsContent>

            <TabsContent value="produtos" className="flex-1 overflow-y-auto mt-4">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar produto..." value={searchProd} onChange={(e) => setSearchProd(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={filterFabricante} onValueChange={setFilterFabricante}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Fabricante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {fabricantes.map((f) => <SelectItem key={f.fabricante_id} value={f.nome}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
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
              </div>
            </TabsContent>

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
                      className="flex-1"
                    />
                    {urls.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeUrl(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

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
