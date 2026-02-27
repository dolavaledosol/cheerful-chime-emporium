import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import ProdutoImageUpload from "@/components/admin/ProdutoImageUpload";

interface Produto {
  produto_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  familia_id: string | null;
  fabricante_id: string | null;
  unidade_medida: string;
  peso_bruto: number | null;
  peso_liquido: number | null;
  preco: number;
  familia?: { nome: string } | null;
  fabricante?: { nome: string } | null;
}

const unidadeLabels: Record<string, string> = {
  un: "un", kg: "kg", g: "g", l: "l", ml: "ml",
  cx: "cx", pct: "pct", par: "par", m: "m", cm: "cm",
};

const emptyForm = {
  nome: "", descricao: "", ativo: true, familia_id: "", fabricante_id: "",
  unidade_medida: "un", peso_bruto: "", peso_liquido: "", preco: "",
};

const Produtos = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [familias, setFamilias] = useState<{ familia_id: string; nome: string }[]>([]);
  const [fabricantes, setFabricantes] = useState<{ fabricante_id: string; nome: string }[]>([]);
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [filterFamilia, setFilterFamilia] = useState<string>("all");
  const [filterFabricante, setFilterFabricante] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const [prodRes, famRes, fabRes] = await Promise.all([
      supabase.from("produto").select("*, familia:familia_id(nome), fabricante:fabricante_id(nome)").order("nome"),
      supabase.from("familia").select("familia_id, nome").eq("ativo", true).order("nome"),
      supabase.from("fabricante").select("fabricante_id, nome").eq("ativo", true).order("nome"),
    ]);
    if (prodRes.data) setProdutos(prodRes.data as any);
    if (famRes.data) setFamilias(famRes.data as any);
    if (fabRes.data) setFabricantes(fabRes.data as any);
  };

  useEffect(() => { load(); }, []);

  const filtered = produtos.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "true" ? p.ativo : !p.ativo);
    const matchFamilia = filterFamilia === "all" || p.familia_id === filterFamilia;
    const matchFabricante = filterFabricante === "all" || p.fabricante_id === filterFabricante;
    return matchSearch && matchAtivo && matchFamilia && matchFabricante;
  });

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (p: Produto) => {
    setEditId(p.produto_id);
    setForm({
      nome: p.nome,
      descricao: p.descricao || "",
      ativo: p.ativo,
      familia_id: p.familia_id || "",
      fabricante_id: p.fabricante_id || "",
      unidade_medida: p.unidade_medida,
      peso_bruto: p.peso_bruto?.toString() || "",
      peso_liquido: p.peso_liquido?.toString() || "",
      preco: p.preco?.toString() || "0",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setLoading(true);
    const payload: any = {
      nome: form.nome,
      descricao: form.descricao || null,
      ativo: form.ativo,
      familia_id: form.familia_id || null,
      fabricante_id: form.fabricante_id || null,
      unidade_medida: form.unidade_medida,
      peso_bruto: form.peso_bruto ? Number(form.peso_bruto) : null,
      peso_liquido: form.peso_liquido ? Number(form.peso_liquido) : null,
      preco: form.preco ? Number(form.preco) : 0,
    };

    let savedId = editId;

    if (editId) {
      const { error } = await supabase.from("produto").update(payload).eq("produto_id", editId);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
    } else {
      const { data, error } = await supabase.from("produto").insert(payload).select("produto_id").single();
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      savedId = data.produto_id;
      setEditId(savedId);
    }

    setLoading(false);
    toast({ title: editId ? "Produto atualizado" : "Produto criado — adicione imagens abaixo" });
    load();
  };

  const softDelete = async (id: string) => {
    await supabase.from("produto").update({ ativo: false }).eq("produto_id", id);
    toast({ title: "Produto desativado" });
    load();
  };

  const weightUnit = (form.unidade_medida === "g" || form.unidade_medida === "kg") ? form.unidade_medida : "kg";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Produto</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterAtivo} onValueChange={setFilterAtivo}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFamilia} onValueChange={setFilterFamilia}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Família" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas famílias</SelectItem>
            {familias.map((f) => <SelectItem key={f.familia_id} value={f.familia_id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterFabricante} onValueChange={setFilterFabricante}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Fabricante" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos fabricantes</SelectItem>
            {fabricantes.map((f) => <SelectItem key={f.fabricante_id} value={f.fabricante_id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Família</TableHead>
              <TableHead className="hidden md:table-cell">Fabricante</TableHead>
              <TableHead className="hidden sm:table-cell">Preço</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.produto_id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{p.familia?.nome || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{p.fabricante?.nome || "—"}</TableCell>
                <TableCell className="hidden sm:table-cell font-medium">R$ {p.preco?.toFixed(2) || "0.00"}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => softDelete(p.produto_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Família</Label>
                <Select value={form.familia_id || "none"} onValueChange={(v) => setForm({ ...form, familia_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {familias.map((f) => <SelectItem key={f.familia_id} value={f.familia_id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fabricante</Label>
                <Select value={form.fabricante_id || "none"} onValueChange={(v) => setForm({ ...form, fabricante_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {fabricantes.map((f) => <SelectItem key={f.fabricante_id} value={f.fabricante_id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unidade_medida} onValueChange={(v) => setForm({ ...form, unidade_medida: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["un","kg","g","l","ml","cx","pct","par","m","cm"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso bruto ({weightUnit})</Label>
                <Input type="number" step="0.001" value={form.peso_bruto} onChange={(e) => setForm({ ...form, peso_bruto: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Peso líquido ({weightUnit})</Label>
                <Input type="number" step="0.001" value={form.peso_liquido} onChange={(e) => setForm({ ...form, peso_liquido: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>

            {/* Image upload - only after product is saved */}
            {editId ? (
              <ProdutoImageUpload produtoId={editId} />
            ) : (
              <p className="text-sm text-muted-foreground italic">Salve o produto primeiro para adicionar imagens.</p>
            )}
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

export default Produtos;
