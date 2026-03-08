import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Configuracao {
  configuracao_id: string;
  chave: string;
  valor: string | null;
}

const emptyForm = { chave: "", valor: "" };

const WEBHOOK_KEYS = [
  { chave: "webhook_cobranca_url", label: "URL do Webhook de Cobrança", placeholder: "https://exemplo.com/webhook" },
  { chave: "webhook_cobranca_apikey", label: "API Key do Webhook", placeholder: "Bearer token ou chave de autenticação" },
];

const Configuracoes = () => {
  const [items, setItems] = useState<Configuracao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [webhookValues, setWebhookValues] = useState<Record<string, string>>({});
  const [savingWebhook, setSavingWebhook] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from("configuracao")
      .select("configuracao_id, chave, valor")
      .is("user_id", null)
      .order("chave");
    if (data) {
      setItems(data);
      // Populate webhook values
      const wv: Record<string, string> = {};
      for (const wk of WEBHOOK_KEYS) {
        const found = data.find(d => d.chave === wk.chave);
        wv[wk.chave] = found?.valor || "";
      }
      setWebhookValues(wv);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Configuracao) => {
    setEditId(c.configuracao_id);
    setForm({ chave: c.chave, valor: c.valor || "" });
    setDialogOpen(true);
  };

  const save = async () => {
    setLoading(true);
    const payload = { chave: form.chave, valor: form.valor || null, user_id: null };
    const { error } = editId
      ? await supabase.from("configuracao").update(payload).eq("configuracao_id", editId)
      : await supabase.from("configuracao").insert(payload);
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Configuração atualizada" : "Configuração criada" });
      setDialogOpen(false);
      load();
    }
  };

  const remove = async (id: string) => {
    await supabase.from("configuracao").delete().eq("configuracao_id", id);
    toast({ title: "Configuração removida" });
    load();
  };

  const saveWebhook = async () => {
    setSavingWebhook(true);
    for (const wk of WEBHOOK_KEYS) {
      const existing = items.find(i => i.chave === wk.chave);
      const val = webhookValues[wk.chave] || null;
      if (existing) {
        await supabase.from("configuracao").update({ valor: val }).eq("configuracao_id", existing.configuracao_id);
      } else {
        await supabase.from("configuracao").insert({ chave: wk.chave, valor: val, user_id: null });
      }
    }
    setSavingWebhook(false);
    toast({ title: "Configurações do webhook salvas" });
    load();
  };

  // Filter out webhook keys from the general table
  const generalItems = items.filter(i => !WEBHOOK_KEYS.some(wk => wk.chave === i.chave));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* Webhook Config Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhook de Cobrança</CardTitle>
          <CardDescription>Configure a URL e a chave de autenticação para envio automático de cobranças via webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {WEBHOOK_KEYS.map((wk) => (
            <div key={wk.chave} className="space-y-2">
              <Label>{wk.label}</Label>
              <Input
                value={webhookValues[wk.chave] || ""}
                onChange={(e) => setWebhookValues(prev => ({ ...prev, [wk.chave]: e.target.value }))}
                placeholder={wk.placeholder}
                type={wk.chave.includes("apikey") ? "password" : "text"}
              />
            </div>
          ))}
          <Button onClick={saveWebhook} disabled={savingWebhook} className="gap-2">
            <Save className="h-4 w-4" />
            {savingWebhook ? "Salvando..." : "Salvar Webhook"}
          </Button>
        </CardContent>
      </Card>

      {/* General Configs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Configurações Gerais</h2>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Configuração</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generalItems.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma configuração encontrada</TableCell></TableRow>
            ) : generalItems.map((c) => (
              <TableRow key={c.configuracao_id}>
                <TableCell className="font-medium font-mono text-sm">{c.chave}</TableCell>
                <TableCell className="text-muted-foreground">{c.valor || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.configuracao_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar Configuração" : "Nova Configuração"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Chave *</Label><Input value={form.chave} onChange={(e) => setForm({ ...form, chave: e.target.value })} placeholder="ex: nome_loja" /></div>
            <div className="space-y-2"><Label>Valor</Label><Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading || !form.chave}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;
