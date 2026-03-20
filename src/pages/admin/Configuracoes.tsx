import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Configuracao {
  configuracao_id: string;
  chave: string;
  valor: string | null;
}

const WEBHOOK_SECTIONS = [
  {
    title: "Webhook de Cobrança",
    description: "Configure a URL e a chave de autenticação para envio automático de cobranças via webhook.",
    keys: [
      { chave: "webhook_cobranca_url", label: "URL do Webhook de Cobrança", placeholder: "https://exemplo.com/webhook" },
      { chave: "webhook_cobranca_apikey", label: "API Key do Webhook de Cobrança", placeholder: "Bearer token ou chave de autenticação" },
    ],
  },
  {
    title: "Webhook de Estoque",
    description: "Configure a URL e a chave de autenticação para envio de relatórios de estoque e clientes via webhook.",
    keys: [
      { chave: "webhook_estoque_url", label: "URL do Webhook de Estoque", placeholder: "https://exemplo.com/webhook-estoque" },
      { chave: "webhook_estoque_apikey", label: "API Key do Webhook de Estoque", placeholder: "Bearer token ou chave de autenticação" },
    ],
  },
  {
    title: "Webhook de Clientes",
    description: "Configure a URL e a chave de autenticação para envio de relatórios de clientes inativos via webhook.",
    keys: [
      { chave: "webhook_cliente_url", label: "URL do Webhook de Clientes", placeholder: "https://exemplo.com/webhook-clientes" },
      { chave: "webhook_cliente_apikey", label: "API Key do Webhook de Clientes", placeholder: "Bearer token ou chave de autenticação" },
    ],
  },
];

const ALL_WEBHOOK_KEYS = WEBHOOK_SECTIONS.flatMap((s) => s.keys.map((k) => k.chave));

const Configuracoes = () => {
  const [items, setItems] = useState<Configuracao[]>([]);
  const [webhookValues, setWebhookValues] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from("configuracao")
      .select("configuracao_id, chave, valor")
      .is("user_id", null)
      .order("chave");
    if (data) {
      setItems(data);
      const wv: Record<string, string> = {};
      for (const key of ALL_WEBHOOK_KEYS) {
        const found = data.find((d) => d.chave === key);
        wv[key] = found?.valor || "";
      }
      setWebhookValues(wv);
    }
  };

  useEffect(() => { load(); }, []);

  const saveWebhookSection = async (sectionTitle: string, keys: typeof WEBHOOK_SECTIONS[0]["keys"]) => {
    setSavingSection(sectionTitle);
    for (const wk of keys) {
      const existing = items.find((i) => i.chave === wk.chave);
      const val = webhookValues[wk.chave] || null;
      if (existing) {
        await supabase.from("configuracao").update({ valor: val }).eq("configuracao_id", existing.configuracao_id);
      } else {
        await supabase.from("configuracao").insert({ chave: wk.chave, valor: val, user_id: null });
      }
    }
    setSavingSection(null);
    toast({ title: `Configurações de ${sectionTitle.toLowerCase()} salvas` });
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {WEBHOOK_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> {section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.keys.map((wk) => (
              <div key={wk.chave} className="space-y-2">
                <Label>{wk.label}</Label>
                <Input
                  value={webhookValues[wk.chave] || ""}
                  onChange={(e) => setWebhookValues((prev) => ({ ...prev, [wk.chave]: e.target.value }))}
                  placeholder={wk.placeholder}
                  type={wk.chave.includes("apikey") ? "password" : "text"}
                />
              </div>
            ))}
            <Button onClick={() => saveWebhookSection(section.title, section.keys)} disabled={savingSection === section.title} className="gap-2">
              <Save className="h-4 w-4" />
              {savingSection === section.title ? "Salvando..." : `Salvar ${section.title}`}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Configuracoes;
