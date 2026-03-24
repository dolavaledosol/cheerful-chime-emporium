import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Package, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";


interface Fornecedor {
  fornecedor_id: string;
  nome: string;
  ativo: boolean;
}

interface Produto {
  produto_id: string;
  nome: string;
  fabricante_id: string | null;
}

interface Fabricante {
  fabricante_id: string;
  nome: string;
}

type FornecedorSortKey = "fornecedor_id" | "nome" | "ativo";

const Fornecedores = () => {
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("true");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", ativo: true });
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<FornecedorSortKey>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  // Produtos tab state
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fabricantes, setFabricantes] = useState<Fabricante[]>([]);
  const [produtoSearch, setProdutoSearch] = useState("");
  const [fabricanteFilter, setFabricanteFilter] = useState<string>("all");
  const [selectedProdutoIds, setSelectedProdutoIds] = useState<Set<string>>(new Set());
  const [initialProdutoIds, setInitialProdutoIds] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await supabase.from("fornecedor").select("*").order("nome");
    if (data) setItems(data as any);
  };

  const loadProdutosAndFabricantes = async () => {
    const [pRes, fRes] = await Promise.all([
      supabase.from("produto").select("produto_id, nome, fabricante_id").eq("ativo", true).order("nome"),
      supabase.from("fabricante").select("fabricante_id, nome").eq("ativo", true).order("nome"),
    ]);
    if (pRes.data) setProdutos(pRes.data);
    if (fRes.data) setFabricantes(fRes.data);
  };

  const loadFornecedorProdutos = async (fornecedorId: string) => {
    const { data } = await supabase.from("fornecedor_produto").select("produto_id").eq("fornecedor_id", fornecedorId);
    const ids = new Set((data || []).map((d: any) => d.produto_id as string));
    setSelectedProdutoIds(ids);
    setInitialProdutoIds(new Set(ids));
  };

  useEffect(() => { load(); loadProdutosAndFabricantes(); }, []);

  const filtered = useMemo(() => {
    let result = items.filter((f) => {
      const matchSearch = f.nome.toLowerCase().includes(search.toLowerCase());
      const matchAtivo = filterAtivo === "all" || (filterAtivo === "true" ? f.ativo : !f.ativo);
      return matchSearch && matchAtivo;
    });
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "fornecedor_id": cmp = a.fornecedor_id.localeCompare(b.fornecedor_id); break;
        case "nome": cmp = a.nome.localeCompare(b.nome, "pt-BR"); break;
        case "ativo": cmp = (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [items, search, filterAtivo, sortKey, sortDir]);

  const handleSort = (key: FornecedorSortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: FornecedorSortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      const matchSearch = p.nome.toLowerCase().includes(produtoSearch.toLowerCase());
      const matchFab = fabricanteFilter === "all" || p.fabricante_id === fabricanteFilter;
      return matchSearch && matchFab;
    });
  }, [produtos, produtoSearch, fabricanteFilter]);

  const openNew = () => {
    setEditId(null);
    setForm({ nome: "", ativo: true });
    setSelectedProdutoIds(new Set());
    setInitialProdutoIds(new Set());
    setProdutoSearch("");
    setFabricanteFilter("all");
    setDialogOpen(true);
  };

  const openEdit = (f: Fornecedor) => {
    setEditId(f.fornecedor_id);
    setForm({ nome: f.nome, ativo: f.ativo });
    setProdutoSearch("");
    setFabricanteFilter("all");
    loadFornecedorProdutos(f.fornecedor_id);
    setDialogOpen(true);
  };

  const toggleProduto = (produtoId: string) => {
    setSelectedProdutoIds((prev) => {
      const next = new Set(prev);
      if (next.has(produtoId)) next.delete(produtoId);
      else next.add(produtoId);
      return next;
    });
  };

  const save = async () => {
    setLoading(true);
    let fornecedorId = editId;

    if (editId) {
      const { error } = await supabase.from("fornecedor").update(form).eq("fornecedor_id", editId);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
    } else {
      const { data, error } = await supabase.from("fornecedor").insert(form).select("fornecedor_id").single();
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      fornecedorId = data.fornecedor_id;
    }

    // Sync fornecedor_produto
    const toAdd = [...selectedProdutoIds].filter((id) => !initialProdutoIds.has(id));
    const toRemove = [...initialProdutoIds].filter((id) => !selectedProdutoIds.has(id));

    if (toRemove.length > 0) {
      await supabase.from("fornecedor_produto").delete().eq("fornecedor_id", fornecedorId!).in("produto_id", toRemove);
    }
    if (toAdd.length > 0) {
      await supabase.from("fornecedor_produto").insert(toAdd.map((produto_id) => ({ fornecedor_id: fornecedorId!, produto_id })));
    }

    setLoading(false);
    toast({ title: editId ? "Fornecedor atualizado" : "Fornecedor criado" });
    setDialogOpen(false);
    load();
  };


  const fabricanteMap = useMemo(() => {
    const m: Record<string, string> = {};
    fabricantes.forEach((f) => (m[f.fabricante_id] = f.nome));
    return m;
  }, [fabricantes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Fornecedor</Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
            ) : filtered.map((f) => (
              <TableRow key={f.fornecedor_id}>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${f.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => softDelete(f.fornecedor_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Basic info */}
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
            </div>

            {/* Produtos section */}
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Produtos Fornecidos</Label>
                <Badge variant="secondary">{selectedProdutoIds.size} selecionado(s)</Badge>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={produtoSearch} onChange={(e) => setProdutoSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={fabricanteFilter} onValueChange={setFabricanteFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos fabricantes</SelectItem>
                    {fabricantes.map((f) => (
                      <SelectItem key={f.fabricante_id} value={f.fabricante_id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 px-2 py-1.5 border rounded-md bg-muted/30">
                <Checkbox
                  checked={filteredProdutos.length > 0 && filteredProdutos.every((p) => selectedProdutoIds.has(p.produto_id))}
                  onCheckedChange={(checked) => {
                    setSelectedProdutoIds((prev) => {
                      const next = new Set(prev);
                      filteredProdutos.forEach((p) => {
                        if (checked) next.add(p.produto_id);
                        else next.delete(p.produto_id);
                      });
                      return next;
                    });
                  }}
                />
                <span className="text-sm font-medium">Marcar todos ({filteredProdutos.length})</span>
              </div>

              <div className="border rounded-md h-[300px] overflow-y-auto">
                <div className="p-2 space-y-1">
                  {filteredProdutos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
                  ) : filteredProdutos.map((p) => (
                    <label key={p.produto_id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                      <Checkbox
                        checked={selectedProdutoIds.has(p.produto_id)}
                        onCheckedChange={() => toggleProduto(p.produto_id)}
                      />
                      <span className="text-sm flex-1">{p.nome}</span>
                      {p.fabricante_id && fabricanteMap[p.fabricante_id] && (
                        <Badge variant="outline" className="text-xs">{fabricanteMap[p.fabricante_id]}</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading || !form.nome}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Fornecedores;
