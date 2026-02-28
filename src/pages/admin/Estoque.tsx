import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, PackagePlus } from "lucide-react";

/* ── Types ── */
interface EstoqueRow {
  estoque_local_id: string;
  produto_id: string;
  local_estoque_id: string;
  preco: number;
  preco_custo: number;
  preco_promocional: number | null;
  quantidade_disponivel: number;
  quantidade_pedida_nao_separada: number;
  produto: { nome: string; preco: number; fabricante: { nome: string } | null; familia: { nome: string } | null } | null;
  local_estoque: { nome: string } | null;
}
interface LocalEstoque { local_estoque_id: string; nome: string; }
interface SelectOption { id: string; nome: string; }
interface Fornecedor { fornecedor_id: string; nome: string; }
interface ProdutoAgrupado {
  produto_id: string; nome: string; fabricante: string; familia: string;
  locais: Record<string, { estoque: number; pedidos: number; estoque_local_id: string }>;
  totalEstoque: number; totalPedidos: number;
}

/* ── Entry line type ── */
interface EntradaLinha {
  produto_id: string;
  nome: string;
  checked: boolean;
  quantidade: string;
  preco_venda: string;   // selling price (produto.preco)
  preco_custo: string;    // cost price
}

const emptyForm = {
  produto_id: "", local_estoque_id: "", preco: "", preco_promocional: "",
  quantidade_disponivel: "", quantidade_pedida_nao_separada: "0",
};

const Estoque = () => {
  const [items, setItems] = useState<EstoqueRow[]>([]);
  const [produtos, setProdutos] = useState<SelectOption[]>([]);
  const [locais, setLocais] = useState<LocalEstoque[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  /* ── Entrada state ── */
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [entradaFornecedor, setEntradaFornecedor] = useState("");
  const [entradaNF, setEntradaNF] = useState("");
  const [entradaFrete, setEntradaFrete] = useState("");
  const [entradaLocal, setEntradaLocal] = useState("");
  const [entradaLinhas, setEntradaLinhas] = useState<EntradaLinha[]>([]);
  const [entradaLoading, setEntradaLoading] = useState(false);
  const [entradaSearchProd, setEntradaSearchProd] = useState("");

  const load = async () => {
    const [{ data: est }, { data: prod }, { data: loc }, { data: forn }] = await Promise.all([
      supabase.from("estoque_local").select("*, produto(nome, preco, fabricante(nome), familia(nome)), local_estoque(nome)").order("produto_id"),
      supabase.from("produto").select("produto_id, nome").eq("ativo", true).order("nome"),
      supabase.from("local_estoque").select("local_estoque_id, nome").eq("ativo", true).order("nome"),
      supabase.from("fornecedor").select("fornecedor_id, nome").eq("ativo", true).order("nome"),
    ]);
    if (est) setItems(est as any);
    if (prod) setProdutos(prod.map((p) => ({ id: p.produto_id, nome: p.nome })));
    if (loc) setLocais(loc as LocalEstoque[]);
    if (forn) setFornecedores(forn);
  };

  useEffect(() => { load(); }, []);

  /* ── Agrupados for main table ── */
  const agrupados = useMemo(() => {
    const map = new Map<string, ProdutoAgrupado>();
    items.forEach((e) => {
      let grupo = map.get(e.produto_id);
      if (!grupo) {
        grupo = {
          produto_id: e.produto_id, nome: e.produto?.nome || "—",
          fabricante: e.produto?.fabricante?.nome || "—", familia: e.produto?.familia?.nome || "—",
          locais: {}, totalEstoque: 0, totalPedidos: 0,
        };
        map.set(e.produto_id, grupo);
      }
      grupo.locais[e.local_estoque_id] = {
        estoque: e.quantidade_disponivel, pedidos: e.quantidade_pedida_nao_separada,
        estoque_local_id: e.estoque_local_id,
      };
      grupo.totalEstoque += Number(e.quantidade_disponivel);
      grupo.totalPedidos += Number(e.quantidade_pedida_nao_separada);
    });
    return Array.from(map.values());
  }, [items]);

  const filtered = agrupados.filter((g) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return g.nome.toLowerCase().includes(term) || g.fabricante.toLowerCase().includes(term) ||
      g.familia.toLowerCase().includes(term) || g.produto_id.toLowerCase().includes(term);
  });

  /* ── Edit single record ── */
  const openEdit = (e: EstoqueRow) => {
    setEditId(e.estoque_local_id);
    setForm({
      produto_id: e.produto_id, local_estoque_id: e.local_estoque_id,
      preco: String(e.preco), preco_promocional: e.preco_promocional != null ? String(e.preco_promocional) : "",
      quantidade_disponivel: String(e.quantidade_disponivel),
      quantidade_pedida_nao_separada: String(e.quantidade_pedida_nao_separada),
    });
    setDialogOpen(true);
  };
  const openEditById = (estoque_local_id: string) => {
    const item = items.find((i) => i.estoque_local_id === estoque_local_id);
    if (item) openEdit(item);
  };
  const save = async () => {
    setLoading(true);
    const payload = {
      produto_id: form.produto_id, local_estoque_id: form.local_estoque_id,
      preco: Number(form.preco), preco_promocional: form.preco_promocional ? Number(form.preco_promocional) : null,
      quantidade_disponivel: Number(form.quantidade_disponivel),
      quantidade_pedida_nao_separada: Number(form.quantidade_pedida_nao_separada),
    };
    const { error } = editId
      ? await supabase.from("estoque_local").update(payload).eq("estoque_local_id", editId)
      : await supabase.from("estoque_local").insert(payload);
    setLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Estoque atualizado" : "Estoque criado" });
    setDialogOpen(false); load();
  };

  /* ═══════════════════  ENTRADA  ═══════════════════ */
  const openEntrada = () => {
    setEntradaFornecedor(""); setEntradaNF(""); setEntradaFrete(""); setEntradaLocal("");
    setEntradaLinhas([]); setEntradaSearchProd(""); setEntradaOpen(true);
  };

  // When supplier changes, load their linked products
  const onFornecedorChange = async (fornecedorId: string) => {
    setEntradaFornecedor(fornecedorId);
    const { data: links } = await supabase
      .from("fornecedor_produto")
      .select("produto_id")
      .eq("fornecedor_id", fornecedorId);
    if (!links || links.length === 0) { setEntradaLinhas([]); return; }

    const prodIds = links.map((l) => l.produto_id);
    const { data: prods } = await supabase
      .from("produto")
      .select("produto_id, nome, preco")
      .in("produto_id", prodIds)
      .eq("ativo", true)
      .order("nome");

    // Get existing cost prices from estoque_local if available
    const { data: existingEstoque } = await supabase
      .from("estoque_local")
      .select("produto_id, preco_custo")
      .in("produto_id", prodIds);
    const custoMap: Record<string, number> = {};
    if (existingEstoque) {
      for (const e of existingEstoque as any[]) {
        if (e.preco_custo && !custoMap[e.produto_id]) custoMap[e.produto_id] = e.preco_custo;
      }
    }

    if (prods) {
      setEntradaLinhas(prods.map((p) => ({
        produto_id: p.produto_id, nome: p.nome, checked: false,
        quantidade: "1",
        preco_venda: String(p.preco || 0),
        preco_custo: String(custoMap[p.produto_id] || 0),
      })));
    }
  };

  const toggleAllEntrada = (checked: boolean) => {
    const filteredIds = new Set(
      filteredEntradaLinhas.map((l) => l.produto_id)
    );
    setEntradaLinhas((prev) =>
      prev.map((l) => filteredIds.has(l.produto_id) ? { ...l, checked } : l)
    );
  };

  const updateLinha = (produto_id: string, field: keyof EntradaLinha, value: any) => {
    setEntradaLinhas((prev) => prev.map((l) => l.produto_id === produto_id ? { ...l, [field]: value } : l));
  };

  const filteredEntradaLinhas = entradaLinhas
    .filter((l) => {
      if (!entradaSearchProd) return true;
      return l.nome.toLowerCase().includes(entradaSearchProd.toLowerCase());
    })
    .sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? -1 : 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

  const checkedLinhas = entradaLinhas.filter((l) => l.checked);
  const totalNF = checkedLinhas.reduce((sum, l) => sum + Number(l.preco_custo) * Number(l.quantidade), 0);

  const saveEntrada = async () => {
    if (!entradaLocal) { toast({ title: "Selecione o local de estoque", variant: "destructive" }); return; }
    if (checkedLinhas.length === 0) { toast({ title: "Marque ao menos um produto", variant: "destructive" }); return; }

    setEntradaLoading(true);
    try {
      // 1. Upsert estoque_local for each checked product
      for (const linha of checkedLinhas) {
        const qty = Number(linha.quantidade);
        const custoVal = Number(linha.preco_custo);
        const vendaVal = Number(linha.preco_venda);

        // Check if estoque_local exists for this product+location
        const { data: existing } = await supabase
          .from("estoque_local")
          .select("estoque_local_id, quantidade_disponivel")
          .eq("produto_id", linha.produto_id)
          .eq("local_estoque_id", entradaLocal)
          .maybeSingle();

        if (existing) {
          await supabase.from("estoque_local").update({
            quantidade_disponivel: Number(existing.quantidade_disponivel) + qty,
            preco_custo: custoVal,
            preco: vendaVal,
          }).eq("estoque_local_id", existing.estoque_local_id);
        } else {
          await supabase.from("estoque_local").insert({
            produto_id: linha.produto_id,
            local_estoque_id: entradaLocal,
            quantidade_disponivel: qty,
            preco_custo: custoVal,
            preco: vendaVal,
          });
        }

        // 2. Update produto.preco (selling price)
        await supabase.from("produto").update({ preco: vendaVal }).eq("produto_id", linha.produto_id);
      }

      // 3. Create contas_pagar for NF
      const fornNome = fornecedores.find((f) => f.fornecedor_id === entradaFornecedor)?.nome || "";
      if (totalNF > 0) {
        await supabase.from("contas_pagar").insert({
          descricao: `NF ${entradaNF || "s/n"} - ${fornNome}`,
          valor: totalNF,
          data_vencimento: new Date().toISOString().slice(0, 10),
          fornecedor_id: entradaFornecedor,
        });
      }

      // 4. Create contas_pagar for freight
      const freteVal = Number(entradaFrete);
      if (freteVal > 0) {
        await supabase.from("contas_pagar").insert({
          descricao: `Frete NF ${entradaNF || "s/n"} - ${fornNome}`,
          valor: freteVal,
          data_vencimento: new Date().toISOString().slice(0, 10),
          fornecedor_id: entradaFornecedor,
        });
      }

      toast({ title: "Entrada registrada com sucesso!" });
      setEntradaOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setEntradaLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estoque</h1>
        <Button onClick={openEntrada} className="gap-2"><PackagePlus className="h-4 w-4" /> Entrada</Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produto, fabricante, família..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* ── Main pivot table ── */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Cód</TableHead>
              <TableHead className="whitespace-nowrap">Produto</TableHead>
              <TableHead className="whitespace-nowrap">Fabricante</TableHead>
              <TableHead className="whitespace-nowrap">Família</TableHead>
              {locais.map((l) => (
                <TableHead key={l.local_estoque_id} className="text-center whitespace-nowrap" colSpan={2}>{l.nome}</TableHead>
              ))}
              <TableHead className="text-center whitespace-nowrap" colSpan={2}>Total</TableHead>
            </TableRow>
            <TableRow>
              <TableHead /><TableHead /><TableHead /><TableHead />
              {locais.map((l) => (
                <>{/* Fragment keys handled by React */}
                  <TableHead key={`${l.local_estoque_id}-est`} className="text-center text-xs whitespace-nowrap">Est.</TableHead>
                  <TableHead key={`${l.local_estoque_id}-ped`} className="text-center text-xs whitespace-nowrap">Ped.</TableHead>
                </>
              ))}
              <TableHead className="text-center text-xs whitespace-nowrap">Est.</TableHead>
              <TableHead className="text-center text-xs whitespace-nowrap">Ped.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4 + locais.length * 2 + 2} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
            ) : filtered.map((g) => (
              <TableRow key={g.produto_id}>
                <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">{g.produto_id.substring(0, 8)}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{g.nome}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{g.fabricante}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{g.familia}</TableCell>
                {locais.map((l) => {
                  const data = g.locais[l.local_estoque_id];
                  return (
                    <>{/* Fragment */}
                      <TableCell key={`${g.produto_id}-${l.local_estoque_id}-est`}
                        className={`text-center cursor-pointer hover:bg-muted/50 ${data ? "" : "text-muted-foreground"}`}
                        onClick={() => data && openEditById(data.estoque_local_id)}>
                        {data ? data.estoque : "—"}
                      </TableCell>
                      <TableCell key={`${g.produto_id}-${l.local_estoque_id}-ped`}
                        className={`text-center ${data ? "" : "text-muted-foreground"}`}>
                        {data ? data.pedidos : "—"}
                      </TableCell>
                    </>
                  );
                })}
                <TableCell className="text-center font-semibold">{g.totalEstoque}</TableCell>
                <TableCell className="text-center font-semibold">{g.totalPedidos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Edit single record dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })} disabled={!!editId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Local de Estoque *</Label>
              <Select value={form.local_estoque_id} onValueChange={(v) => setForm({ ...form, local_estoque_id: v })} disabled={!!editId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{locais.map((l) => <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Preço *</Label><Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} /></div>
              <div className="space-y-2"><Label>Preço Promocional</Label><Input type="number" step="0.01" value={form.preco_promocional} onChange={(e) => setForm({ ...form, preco_promocional: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Qtd Disponível *</Label><Input type="number" value={form.quantidade_disponivel} onChange={(e) => setForm({ ...form, quantidade_disponivel: e.target.value })} /></div>
              <div className="space-y-2"><Label>Qtd Pedida Não Sep.</Label><Input type="number" value={form.quantidade_pedida_nao_separada} onChange={(e) => setForm({ ...form, quantidade_pedida_nao_separada: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading || !form.produto_id || !form.local_estoque_id || !form.preco}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════  DIALOG ENTRADA  ═══════════════════ */}
      <Dialog open={entradaOpen} onOpenChange={setEntradaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Entrada de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2 col-span-2 md:col-span-1">
                <Label>Fornecedor *</Label>
                <Select value={entradaFornecedor} onValueChange={onFornecedorChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{fornecedores.map((f) => <SelectItem key={f.fornecedor_id} value={f.fornecedor_id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nº NF</Label>
                <Input value={entradaNF} onChange={(e) => setEntradaNF(e.target.value)} placeholder="123456" />
              </div>
              <div className="space-y-2">
                <Label>Valor Frete</Label>
                <Input type="number" step="0.01" value={entradaFrete} onChange={(e) => setEntradaFrete(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Local Estoque *</Label>
                <Select value={entradaLocal} onValueChange={setEntradaLocal}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{locais.map((l) => <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Product list */}
            {entradaLinhas.length > 0 && (
              <>
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filtrar produtos..." value={entradaSearchProd} onChange={(e) => setEntradaSearchProd(e.target.value)} className="pl-10" />
                </div>
                <div className="border rounded-lg overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filteredEntradaLinhas.length > 0 && filteredEntradaLinhas.every((l) => l.checked)}
                            onCheckedChange={(v) => toggleAllEntrada(!!v)}
                          />
                        </TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-24">Qtd</TableHead>
                        <TableHead className="w-32">Preço Venda</TableHead>
                        <TableHead className="w-32">Preço Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntradaLinhas.map((l) => (
                        <TableRow key={l.produto_id} className={l.checked ? "bg-muted/30" : ""}>
                          <TableCell>
                            <Checkbox checked={l.checked} onCheckedChange={(v) => updateLinha(l.produto_id, "checked", !!v)} />
                          </TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell>
                            <Input type="number" min="1" value={l.quantidade} onChange={(e) => updateLinha(l.produto_id, "quantidade", e.target.value)} className="h-8" disabled={!l.checked} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={l.preco_venda} onChange={(e) => updateLinha(l.produto_id, "preco_venda", e.target.value)} className="h-8" disabled={!l.checked} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={l.preco_custo} onChange={(e) => updateLinha(l.produto_id, "preco_custo", e.target.value)} className="h-8" disabled={!l.checked} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between text-sm border-t pt-3">
                  <span className="text-muted-foreground">{checkedLinhas.length} produto(s) selecionado(s)</span>
                  <div className="space-x-4">
                    <span>Total NF: <strong>R$ {totalNF.toFixed(2)}</strong></span>
                    {Number(entradaFrete) > 0 && <span>Frete: <strong>R$ {Number(entradaFrete).toFixed(2)}</strong></span>}
                  </div>
                </div>
              </>
            )}

            {entradaFornecedor && entradaLinhas.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum produto vinculado a este fornecedor.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntradaOpen(false)}>Cancelar</Button>
            <Button onClick={saveEntrada} disabled={entradaLoading || checkedLinhas.length === 0 || !entradaLocal}>
              {entradaLoading ? "Salvando..." : "Confirmar Entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
