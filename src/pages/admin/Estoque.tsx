import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

interface EstoqueRow {
  estoque_local_id: string;
  produto_id: string;
  local_estoque_id: string;
  preco: number;
  preco_promocional: number | null;
  quantidade_disponivel: number;
  quantidade_pedida_nao_separada: number;
  produto: { nome: string; fabricante: { nome: string } | null; familia: { nome: string } | null } | null;
  local_estoque: { nome: string } | null;
}

interface LocalEstoque { local_estoque_id: string; nome: string; }
interface SelectOption { id: string; nome: string; }

interface ProdutoAgrupado {
  produto_id: string;
  nome: string;
  fabricante: string;
  familia: string;
  locais: Record<string, { estoque: number; pedidos: number; estoque_local_id: string }>;
  totalEstoque: number;
  totalPedidos: number;
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

  const load = async () => {
    const [{ data: est }, { data: prod }, { data: loc }] = await Promise.all([
      supabase.from("estoque_local").select("*, produto(nome, fabricante(nome), familia(nome)), local_estoque(nome)").order("produto_id"),
      supabase.from("produto").select("produto_id, nome").eq("ativo", true).order("nome"),
      supabase.from("local_estoque").select("local_estoque_id, nome").eq("ativo", true).order("nome"),
    ]);
    if (est) setItems(est as any);
    if (prod) setProdutos(prod.map((p) => ({ id: p.produto_id, nome: p.nome })));
    if (loc) setLocais(loc as LocalEstoque[]);
  };

  useEffect(() => { load(); }, []);

  const agrupados = useMemo(() => {
    const map = new Map<string, ProdutoAgrupado>();
    items.forEach((e) => {
      let grupo = map.get(e.produto_id);
      if (!grupo) {
        grupo = {
          produto_id: e.produto_id,
          nome: e.produto?.nome || "—",
          fabricante: e.produto?.fabricante?.nome || "—",
          familia: e.produto?.familia?.nome || "—",
          locais: {},
          totalEstoque: 0,
          totalPedidos: 0,
        };
        map.set(e.produto_id, grupo);
      }
      grupo.locais[e.local_estoque_id] = {
        estoque: e.quantidade_disponivel,
        pedidos: e.quantidade_pedida_nao_separada,
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
    return g.nome.toLowerCase().includes(term) ||
      g.fabricante.toLowerCase().includes(term) ||
      g.familia.toLowerCase().includes(term) ||
      g.produto_id.toLowerCase().includes(term);
  });

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
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
      produto_id: form.produto_id,
      local_estoque_id: form.local_estoque_id,
      preco: Number(form.preco),
      preco_promocional: form.preco_promocional ? Number(form.preco_promocional) : null,
      quantidade_disponivel: Number(form.quantidade_disponivel),
      quantidade_pedida_nao_separada: Number(form.quantidade_pedida_nao_separada),
    };
    const { error } = editId
      ? await supabase.from("estoque_local").update(payload).eq("estoque_local_id", editId)
      : await supabase.from("estoque_local").insert(payload);
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Estoque atualizado" : "Estoque criado" });
      setDialogOpen(false);
      load();
    }
  };

  const remove = async (id: string) => {
    await supabase.from("estoque_local").delete().eq("estoque_local_id", id);
    toast({ title: "Registro removido" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estoque</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Registro</Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produto, fabricante, família..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Cód</TableHead>
              <TableHead className="whitespace-nowrap">Produto</TableHead>
              <TableHead className="whitespace-nowrap">Fabricante</TableHead>
              <TableHead className="whitespace-nowrap">Família</TableHead>
              {locais.map((l) => (
                <TableHead key={l.local_estoque_id} className="text-center whitespace-nowrap" colSpan={2}>
                  {l.nome}
                </TableHead>
              ))}
              <TableHead className="text-center whitespace-nowrap" colSpan={2}>Total</TableHead>
            </TableRow>
            <TableRow>
              <TableHead />
              <TableHead />
              <TableHead />
              <TableHead />
              {locais.map((l) => (
                <>
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
                    <>
                      <TableCell
                        key={`${g.produto_id}-${l.local_estoque_id}-est`}
                        className={`text-center cursor-pointer hover:bg-muted/50 ${data ? "" : "text-muted-foreground"}`}
                        onClick={() => data && openEditById(data.estoque_local_id)}
                      >
                        {data ? data.estoque : "—"}
                      </TableCell>
                      <TableCell
                        key={`${g.produto_id}-${l.local_estoque_id}-ped`}
                        className={`text-center ${data ? "" : "text-muted-foreground"}`}
                      >
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Estoque" : "Novo Estoque"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Local de Estoque *</Label>
              <Select value={form.local_estoque_id} onValueChange={(v) => setForm({ ...form, local_estoque_id: v })}>
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
    </div>
  );
};

export default Estoque;
