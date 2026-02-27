import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

interface Banco { banco_id: string; nome: string; codigo: string | null; conta_corrente: string | null; ativo: boolean; }

const Bancos = () => {
  const [items, setItems] = useState<Banco[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", codigo: "", conta_corrente: "", ativo: true });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from("banco").select("*").order("nome");
    if (data) setItems(data as any);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((b) => b.nome.toLowerCase().includes(search.toLowerCase()) || b.codigo?.includes(search));

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

  const softDelete = async (id: string) => {
    await supabase.from("banco").update({ ativo: false }).eq("banco_id", id);
    toast({ title: "Banco desativado" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bancos</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Banco</Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Código</TableHead><TableHead>Conta Corrente</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum banco encontrado</TableCell></TableRow>
            ) : filtered.map((b) => (
              <TableRow key={b.banco_id}>
                <TableCell className="font-medium">{b.nome}</TableCell>
                <TableCell className="text-muted-foreground">{b.codigo || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{b.conta_corrente || "—"}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {b.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => softDelete(b.banco_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
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
