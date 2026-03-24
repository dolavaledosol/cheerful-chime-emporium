import { useEffect, useMemo, useState } from "react";
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
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface Familia {
  familia_id: string;
  nome: string;
  descricao: string | null;
  familia_pai_id: string | null;
  ativo: boolean;
  pai?: { nome: string } | null;
}

type SortKey = "familia_id" | "nome" | "pai" | "ativo";

const emptyForm = { nome: "", descricao: "", familia_pai_id: "", ativo: true };

const Familias = () => {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("true");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from("familia").select("*, pai:familia_pai_id(nome)").order("nome");
    if (data) setFamilias(data as any);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = familias.filter((f) => {
      const matchSearch = f.nome.toLowerCase().includes(search.toLowerCase());
      const matchAtivo = filterAtivo === "all" || (filterAtivo === "true" ? f.ativo : !f.ativo);
      return matchSearch && matchAtivo;
    });
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "familia_id": cmp = a.familia_id.localeCompare(b.familia_id); break;
        case "nome": cmp = a.nome.localeCompare(b.nome, "pt-BR"); break;
        case "pai": cmp = (a.pai?.nome || "").localeCompare(b.pai?.nome || "", "pt-BR"); break;
        case "ativo": cmp = (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [familias, search, filterAtivo, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (f: Familia) => {
    setEditId(f.familia_id);
    setForm({ nome: f.nome, descricao: f.descricao || "", familia_pai_id: f.familia_pai_id || "", ativo: f.ativo });
    setDialogOpen(true);
  };

  const save = async () => {
    setLoading(true);
    const payload: any = { nome: form.nome, descricao: form.descricao || null, familia_pai_id: form.familia_pai_id || null, ativo: form.ativo };
    const { error } = editId
      ? await supabase.from("familia").update(payload).eq("familia_id", editId)
      : await supabase.from("familia").insert(payload);
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Família atualizada" : "Família criada" });
      setDialogOpen(false);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Famílias</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Família</Button>
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
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("familia_id")}>Cód <SortIcon col="familia_id" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>Nome <SortIcon col="nome" /></TableHead>
              <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("pai")}>Família pai <SortIcon col="pai" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("ativo")}>Status <SortIcon col="ativo" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma família encontrada</TableCell></TableRow>
            ) : filtered.map((f) => (
              <TableRow key={f.familia_id}>
                <TableCell>
                  <button className="text-xs font-mono text-primary hover:underline cursor-pointer" onClick={() => openEdit(f)}>
                    {f.familia_id.substring(0, 8)}
                  </button>
                </TableCell>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{f.pai?.nome || "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${f.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Família" : "Nova Família"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} /></div>
            <div className="space-y-2">
              <Label>Família pai (subfamília de)</Label>
              <Select value={form.familia_pai_id || "none"} onValueChange={(v) => setForm({ ...form, familia_pai_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {familias.filter((f) => f.familia_id !== editId).map((f) => (
                    <SelectItem key={f.familia_id} value={f.familia_id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

export default Familias;
