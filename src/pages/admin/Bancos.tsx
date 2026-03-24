import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface Banco { banco_id: string; nome: string; codigo: string | null; conta_corrente: string | null; ativo: boolean; }

type SortKey = "banco_id" | "nome" | "codigo" | "conta_corrente" | "ativo";

const Bancos = () => {
  const [items, setItems] = useState<Banco[]>([]);
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("true");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", codigo: "", conta_corrente: "", ativo: true });
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from("banco").select("*").order("nome");
    if (data) setItems(data as any);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = items.filter((b) => {
      const matchSearch = b.nome.toLowerCase().includes(search.toLowerCase()) || b.codigo?.includes(search);
      const matchAtivo = filterAtivo === "all" || (filterAtivo === "true" ? b.ativo : !b.ativo);
      return matchSearch && matchAtivo;
    });
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "banco_id": cmp = a.banco_id.localeCompare(b.banco_id); break;
        case "nome": cmp = a.nome.localeCompare(b.nome, "pt-BR"); break;
        case "codigo": cmp = (a.codigo || "").localeCompare(b.codigo || "", "pt-BR"); break;
        case "conta_corrente": cmp = (a.conta_corrente || "").localeCompare(b.conta_corrente || "", "pt-BR"); break;
        case "ativo": cmp = (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [items, search, filterAtivo, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const openNew = () => { setEditId(null); setForm({ nome: "", codigo: "", conta_corrente: "", ativo: true }); setDialogOpen(true); };
  const openEdit = (b: Banco) => { setEditId(b.banco_id); setForm({ nome: b.nome, codigo: b.codigo || "", conta_corrente: b.conta_corrente || "", ativo: b.ativo }); setDialogOpen(true); };

  const save = async () => {
    setLoading(true);
    const payload = { nome: form.nome, codigo: form.codigo || null, conta_corrente: form.conta_corrente || null, ativo: form.ativo };
    const { error } = editId
      ? await supabase.from("banco").update(payload).eq("banco_id", editId)
      : await supabase.from("banco").insert(payload);
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Banco atualizado" : "Banco criado" });
      setDialogOpen(false);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bancos</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Banco</Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterAtivo} onValueChange={setFilterAtivo}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("banco_id")}>Cód <SortIcon col="banco_id" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>Nome <SortIcon col="nome" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("codigo")}>Código <SortIcon col="codigo" /></TableHead>
              <TableHead className="cursor-pointer select-none hidden sm:table-cell" onClick={() => handleSort("conta_corrente")}>Conta Corrente <SortIcon col="conta_corrente" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("ativo")}>Status <SortIcon col="ativo" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum banco encontrado</TableCell></TableRow>
            ) : filtered.map((b) => (
              <TableRow key={b.banco_id}>
                <TableCell>
                  <button className="text-xs font-mono text-primary hover:underline cursor-pointer" onClick={() => openEdit(b)}>
                    {b.banco_id.substring(0, 8)}
                  </button>
                </TableCell>
                <TableCell className="font-medium">{b.nome}</TableCell>
                <TableCell className="text-muted-foreground">{b.codigo || "—"}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{b.conta_corrente || "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {b.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Banco" : "Novo Banco"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
            <div className="space-y-2"><Label>Conta Corrente</Label><Input value={form.conta_corrente} onChange={(e) => setForm({ ...form, conta_corrente: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
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

export default Bancos;
