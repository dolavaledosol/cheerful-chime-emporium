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
import { Plus, Search, Pencil, Trash2, AlertCircle, Star, MessageCircle } from "lucide-react";
import { PhoneInput, phoneToDigits, digitsToPhone } from "@/components/ui/phone-input";
import { formatCpfCnpj, unformatCpfCnpj, validateCpfCnpj } from "@/lib/cpfCnpj";
import { isValidPhoneNumber } from "react-phone-number-input";

interface Cliente {
  cliente_id: string;
  clientewhats_id: number | null;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  tipo_cliente: string;
  ativo: boolean;
  telefone_preferencial_id: string | null;
}

interface TelefoneItem {
  id?: string;
  telefone: string; // E.164 format
  is_whatsapp?: boolean;
  verificado?: boolean;
}

const emptyForm = { nome: "", cpf_cnpj: "", email: "", tipo_cliente: "cliente", ativo: true };

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("ativo");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [cpfLocked, setCpfLocked] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [telefones, setTelefones] = useState<TelefoneItem[]>([]);
  const [telefonePreferencialId, setTelefonePreferencialId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from("cliente").select("*").order("nome");
    if (data) setClientes(data as any);
  };

  useEffect(() => { load(); }, []);

  const filtered = clientes.filter((c) => {
    const term = search.toLowerCase();
    const matchText = c.nome.toLowerCase().includes(term) || c.cpf_cnpj?.includes(term) || c.email?.toLowerCase().includes(term);
    const matchStatus = statusFilter === "todos" ? true : statusFilter === "ativo" ? c.ativo : !c.ativo;
    return matchText && matchStatus;
  });

  const openNew = () => { setEditId(null); setForm(emptyForm); setTelefones([{ telefone: "" }]); setTelefonePreferencialId(null); setCpfError(null); setCpfLocked(false); setDialogOpen(true); };
  const openEdit = (c: Cliente) => {
    setEditId(c.cliente_id);
    setCpfError(null);
    setCpfLocked(!!c.cpf_cnpj);
    setForm({
      nome: c.nome,
      cpf_cnpj: c.cpf_cnpj ? formatCpfCnpj(c.cpf_cnpj) : "",
      email: c.email || "",
      tipo_cliente: c.tipo_cliente,
      ativo: c.ativo,
    });
    setTelefones([]);
    setTelefonePreferencialId((c as any).telefone_preferencial_id || null);
    supabase.from("cliente_telefone").select("cliente_telefone_id, telefone, is_whatsapp, verificado").eq("cliente_id", c.cliente_id).then(({ data }) => {
      if (data && data.length > 0) {
        setTelefones(data.map(t => ({ id: t.cliente_telefone_id, telefone: digitsToPhone(t.telefone), is_whatsapp: t.is_whatsapp, verificado: t.verificado })));
      } else {
        setTelefones([{ telefone: "" }]);
      }
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const cpfDigits = unformatCpfCnpj(form.cpf_cnpj);
    if (cpfDigits.length > 0) {
      const err = validateCpfCnpj(cpfDigits);
      if (err) { setCpfError(err); toast({ title: err, variant: "destructive" }); return; }
    }

    // Validate phones
    const validPhones = telefones.filter(t => t.telefone && phoneToDigits(t.telefone).length > 0);
    for (const tel of validPhones) {
      if (!isValidPhoneNumber(tel.telefone)) {
        toast({ title: "Telefone inválido", description: `Verifique o número: ${tel.telefone}`, variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    const payload: any = {
      nome: form.nome,
      cpf_cnpj: cpfDigits || null,
      email: form.email || null,
      tipo_cliente: form.tipo_cliente,
      ativo: form.ativo,
    };

    let error: any = null;
    let actionLabel = "";

    if (editId) {
      const res = await supabase.from("cliente").update(payload).eq("cliente_id", editId);
      error = res.error;
      actionLabel = "Cliente atualizado";
    } else if (form.cpf_cnpj) {
      const { data: existing } = await supabase.from("cliente").select("cliente_id").eq("cpf_cnpj", form.cpf_cnpj).maybeSingle();
      if (existing) {
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
      let targetId = editId;
      if (!targetId && form.cpf_cnpj) {
        const { data: found } = await supabase.from("cliente").select("cliente_id").eq("cpf_cnpj", form.cpf_cnpj).maybeSingle();
        targetId = found?.cliente_id || null;
      }
      if (!targetId) {
        const { data: latest } = await supabase.from("cliente").select("cliente_id").eq("nome", form.nome).order("created_at", { ascending: false }).limit(1);
        targetId = latest?.[0]?.cliente_id || null;
      }

      if (targetId) {
        const validPhonesForSave = telefones.filter(t => t.telefone && phoneToDigits(t.telefone).length > 0);
        const { data: existingTels } = await supabase.from("cliente_telefone").select("cliente_telefone_id").eq("cliente_id", targetId);
        const keepIds = validPhonesForSave.filter(t => t.id).map(t => t.id!);
        const toDelete = (existingTels || []).filter(t => !keepIds.includes(t.cliente_telefone_id));
        for (const del of toDelete) {
          await supabase.from("cliente_telefone").delete().eq("cliente_telefone_id", del.cliente_telefone_id);
        }
        for (let i = 0; i < validPhonesForSave.length; i++) {
          const tel = validPhonesForSave[i];
          const digits = phoneToDigits(tel.telefone);
          if (tel.id) {
            await supabase.from("cliente_telefone").update({ telefone: digits }).eq("cliente_telefone_id", tel.id);
          } else {
            const { data: inserted } = await supabase.from("cliente_telefone").insert({ cliente_id: targetId, telefone: digits }).select("cliente_telefone_id").single();
            if (inserted) {
              tel.id = inserted.cliente_telefone_id;
            }
          }
        }

        // Save preferred phone
        let prefId = telefonePreferencialId;
        // If preferred was a new phone (no id before save), find by index
        const prefPhone = validPhonesForSave.find(t => t.id === prefId);
        if (!prefPhone && validPhonesForSave.length > 0) {
          prefId = validPhonesForSave[0].id || null;
        }
        await supabase.from("cliente").update({ telefone_preferencial_id: prefId || null } as any).eq("cliente_id", targetId);
      }

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF/CNPJ ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Código</TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
            ) : filtered.map((c) => (
              <TableRow key={c.cliente_id}>
                <TableCell className="text-muted-foreground text-xs font-mono">{c.cliente_id.slice(0, 8)}</TableCell>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{c.cpf_cnpj ? formatCpfCnpj(c.cpf_cnpj) : "—"}</TableCell>
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
                <Input
                  value={form.cpf_cnpj}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  onChange={(e) => { if (!cpfLocked) { setForm({ ...form, cpf_cnpj: formatCpfCnpj(e.target.value) }); setCpfError(null); } }}
                  disabled={cpfLocked}
                  className={`${cpfError ? "border-destructive" : ""} ${cpfLocked ? "bg-muted" : ""}`}
                />
                {cpfLocked && <p className="text-[11px] text-muted-foreground">Não pode ser alterado após cadastrado</p>}
                {cpfError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {cpfError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Telefones</Label>
                <Button type="button" variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setTelefones([...telefones, { telefone: "" }])}>
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
              {telefones.map((tel, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <button
                    type="button"
                    title={tel.id && telefonePreferencialId === tel.id ? "Telefone preferencial" : "Definir como preferencial"}
                    className="shrink-0"
                    onClick={() => tel.id && setTelefonePreferencialId(tel.id)}
                  >
                    <Star className={`h-4 w-4 ${tel.id && telefonePreferencialId === tel.id ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`} />
                  </button>
                  {tel.verificado && tel.is_whatsapp && (
                    <span title="WhatsApp verificado" className="shrink-0">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </span>
                  )}
                  <PhoneInput
                    value={tel.telefone}
                    onChange={(val) => {
                      const updated = [...telefones];
                      updated[idx] = { ...updated[idx], telefone: val };
                      setTelefones(updated);
                    }}
                    className="flex-1"
                  />
                  {telefones.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                      if (tel.id && telefonePreferencialId === tel.id) setTelefonePreferencialId(null);
                      setTelefones(telefones.filter((_, i) => i !== idx));
                    }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">Clique na ★ para definir o telefone preferencial para cobrança</p>
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
