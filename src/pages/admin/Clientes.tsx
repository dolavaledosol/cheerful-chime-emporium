import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

interface Cliente {
  cliente_id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  tipo_cliente: string;
  ativo: boolean;
}

const emptyForm = { nome: "", cpf_cnpj: "", email: "", tipo_cliente: "cliente", ativo: true };

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from("cliente").select("*").order("nome");
    if (data) setClientes(data as any);
  };

  useEffect(() => { load(); }, []);

  const filtered = clientes.filter((c) => {
    const term = search.toLowerCase();
    return c.nome.toLowerCase().includes(term) || c.cpf_cnpj?.includes(term) || c.email?.toLowerCase().includes(term);
  });

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Cliente) => {
    setEditId(c.cliente_id);
    setForm({
      nome: c.nome,
      cpf_cnpj: c.cpf_cnpj || "",
      email: c.email || "",
      tipo_cliente: c.tipo_cliente,
      ativo: c.ativo,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setLoading(true);
    const payload: any = {
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      tipo_cliente: form.tipo_cliente,
      ativo: form.ativo,
    };

    let error: any = null;
    let actionLabel = "";

    if (editId) {
      // Editando diretamente
      const res = await supabase.from("cliente").update(payload).eq("cliente_id", editId);
      error = res.error;
      actionLabel = "Cliente atualizado";
    } else if (form.cpf_cnpj) {
      // Novo: buscar por CPF/CNPJ se existir
      const { data: existing } = await supabase
        .from("cliente")
        .select("cliente_id")
        .eq("cpf_cnpj", form.cpf_cnpj)
        .maybeSingle();

      if (existing) {
        // CPF já existe — atualiza o registro (inclusive o email)
        const res = await supabase.from("cliente").update(payload).eq("cliente_id", existing.cliente_id);
        error = res.error;
        actionLabel = "Cliente encontrado por CPF/CNPJ e atualizado";
      } else {
        const res = await supabase.from("cliente").insert(payload);
        error = res.error;
        actionLabel = "Cliente criado";
      }
    } else {
      const res = await supabase.from("cliente").insert(payload);
      error = res.error;
      actionLabel = "Cliente criado";
    }

    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: actionLabel });
      setDialogOpen(false);
      load();
    }
  };

  const softDelete = async (id: string) => {
    await supabase.from("cliente").update({ ativo: false }).eq("cliente_id", id);
    toast({ title: "Cliente desativado" });
    load();
  };

  const tipoLabel = (t: string) => {
    switch (t) {
      case "admin": return "Admin";
      case "vendedor": return "Vendedor";
      default: return "Cliente";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Cliente</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CPF/CNPJ ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">CPF/CNPJ</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
            ) : filtered.map((c) => (
              <TableRow key={c.cliente_id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{c.cpf_cnpj || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{c.email || "—"}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{tipoLabel(c.tipo_cliente)}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => softDelete(c.cliente_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo_cliente} onValueChange={(v) => setForm({ ...form, tipo_cliente: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Ativo</Label>
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

export default Clientes;
