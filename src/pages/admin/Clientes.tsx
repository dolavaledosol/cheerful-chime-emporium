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
import { Plus, Search, Trash2, AlertCircle, Star, MessageCircle } from "lucide-react";
import ClientesInativosRelatorio from "@/components/admin/ClientesInativosRelatorio";
import CampanhaRelatorio from "@/components/admin/CampanhaRelatorio";
import { PhoneInput, phoneToDigits, digitsToPhone } from "@/components/ui/phone-input";
import { formatCpfCnpj, unformatCpfCnpj, validateCpfCnpj } from "@/lib/cpfCnpj";
import { isValidPhoneNumber } from "react-phone-number-input";
import { useIsMobile } from "@/hooks/use-mobile";

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
  telefone: string;
  is_whatsapp?: boolean;
  verificado?: boolean;
  originalTelefone?: string;
}

const emptyForm = { nome: "", cpf_cnpj: "", email: "", tipo_cliente: "cliente", ativo: true };

const tipoLabel = (t: string) => {
  switch (t) {
    case "admin": return "Admin";
    case "vendedor": return "Vendedor";
    default: return "Cliente";
  }
};

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
  const isMobile = useIsMobile();

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
        setTelefones(data.map(t => ({ id: t.cliente_telefone_id, telefone: digitsToPhone(t.telefone), is_whatsapp: t.is_whatsapp, verificado: t.verificado, originalTelefone: digitsToPhone(t.telefone) })));
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
            const changed = tel.originalTelefone !== tel.telefone;
            await supabase.from("cliente_telefone").update({ telefone: digits, ...(changed ? { verificado: false, is_whatsapp: false } : {}) }).eq("cliente_telefone_id", tel.id);
          } else {
            const { data: inserted } = await supabase.from("cliente_telefone").insert({ cliente_id: targetId, telefone: digits, verificado: false }).select("cliente_telefone_id").single();
            if (inserted) {
              tel.id = inserted.cliente_telefone_id;
            }
          }
        }

        let prefId = telefonePreferencialId;
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-2">
          <CampanhaRelatorio />
          <ClientesInativosRelatorio />
          <Button onClick={openNew} size={isMobile ? "icon" : "default"} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {!isMobile && "Novo Cliente"}
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-28 sm:w-40 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: cards / Desktop: table */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Nenhum cliente encontrado</p>
          ) : filtered.map((c) => (
            <button
              key={c.cliente_id}
              onClick={() => openEdit(c)}
              className="w-full text-left rounded-xl border bg-card p-3.5 space-y-1.5 hover:border-primary/40 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm leading-tight">{c.nome}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted">{tipoLabel(c.tipo_cliente)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {c.cpf_cnpj && <span>{formatCpfCnpj(c.cpf_cnpj)}</span>}
                {c.email && <span className="truncate">{c.email}</span>}
                {!c.cpf_cnpj && !c.email && <span>—</span>}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Cód</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.cliente_id}>
                  <TableCell>
                    <button className="text-xs font-mono text-primary hover:underline cursor-pointer" onClick={() => openEdit(c)}>
                      {c.cliente_id.slice(0, 8)}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.cpf_cnpj ? formatCpfCnpj(c.cpf_cnpj) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{tipoLabel(c.tipo_cliente)}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="h-11" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={form.cpf_cnpj}
                  placeholder="000.000.000-00"
                  onChange={(e) => { if (!cpfLocked) { setForm({ ...form, cpf_cnpj: formatCpfCnpj(e.target.value) }); setCpfError(null); } }}
                  disabled={cpfLocked}
                  className={`h-11 ${cpfError ? "border-destructive" : ""} ${cpfLocked ? "bg-muted" : ""}`}
                />
                {cpfLocked && <p className="text-[11px] text-muted-foreground">Não pode ser alterado após cadastrado</p>}
                {cpfError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {cpfError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11" />
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
                    className="shrink-0 p-1"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo_cliente} onValueChange={(v) => setForm({ ...form, tipo_cliente: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 sm:pt-6">
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
