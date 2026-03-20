import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, UserX } from "lucide-react";

interface ClienteInativo {
  cliente_id: string;
  nome: string;
  lid: string | null;
  ultima_compra: string;
  produtos: {
    produto_id: string;
    nome: string;
    fabricante: string | null;
    peso: number | null;
    unidade_medida: string;
    preco: number;
    url_imagem: string | null;
    quantidade_total: number;
  }[];
}

const safeJsonParse = (value: string) => {
  try { return JSON.parse(value); } catch { return null; }
};

const invokeWebhookProxy = async (body: {
  webhook_url: string;
  webhook_apikey?: string;
  log_tipo?: string;
  payload: unknown;
}) => {
  try {
    const { data, error } = await supabase.functions.invoke("webhook-proxy", { body });
    if (error) throw error;
    return data;
  } catch (error: any) {
    const isFetchError =
      error?.name === "FunctionsFetchError" ||
      error?.message?.includes("Failed to send a request to the Edge Function");

    if (!isFetchError) throw error;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw error;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    const responseJson = responseText ? safeJsonParse(responseText) : null;

    if (!response.ok) {
      const errorMessage =
        responseJson && typeof responseJson === "object" && "error" in responseJson
          ? String((responseJson as { error: unknown }).error)
          : responseText || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return responseJson ?? responseText;
  }
};

const ClientesInativosRelatorio = () => {
  const [meses, setMeses] = useState(3);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clientes, setClientes] = useState<ClienteInativo[]>([]);
  const { toast } = useToast();

  const fetchRelatorio = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Não autenticado", variant: "destructive" });
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relatorio-clientes-inativos?meses=${meses}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setClientes(data);
      setPreviewOpen(true);
    } catch (err: any) {
      toast({ title: "Erro ao gerar relatório", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendWebhook = async () => {
    const { data: configs } = await supabase
      .from("configuracao")
      .select("chave, valor")
      .in("chave", ["webhook_cliente_url", "webhook_cliente_apikey"])
      .is("user_id", null);

    const configMap: Record<string, string> = {};
    if (configs) configs.forEach((c: any) => { configMap[c.chave] = c.valor || ""; });

    const webhookUrl = configMap["webhook_cliente_url"];
    const webhookApikey = configMap["webhook_cliente_apikey"];

    if (!webhookUrl) {
      toast({ title: "Webhook não configurado", description: "Configure a URL do webhook de clientes em Configurações.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const payload = {
        tipo: "relatorio_clientes_inativos",
        meses,
        clientes: clientes.map((c) => ({
          cliente_id: c.cliente_id,
          nome: c.nome,
          ...(c.lid ? { lid: c.lid } : {}),
          ultima_compra: c.ultima_compra,
          produtos: c.produtos.map((pr) => ({
            produto_id: pr.produto_id,
            nome: pr.nome,
            fabricante: pr.fabricante,
            peso: pr.peso,
            unidade_medida: pr.unidade_medida,
            preco: pr.preco,
            url_imagem: pr.url_imagem,
            quantidade_total: pr.quantidade_total,
          })),
        })),
      };

      const response = await invokeWebhookProxy({
        webhook_url: webhookUrl,
        webhook_apikey: webhookApikey,
        log_tipo: "webhook_cliente",
        payload,
      });

      if (response && typeof response === "object" && "error" in response && response.error) {
        throw new Error(String(response.error));
      }

      toast({ title: "Relatório de clientes ausentes enviado!" });
      setPreviewOpen(false);
    } catch (err: any) {
      console.error("Erro ao enviar relatório de clientes", err);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Meses sem compra</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value) || 3)}
            className="w-24 h-9"
          />
        </div>
        <Button variant="outline" onClick={fetchRelatorio} disabled={loading} className="gap-2 h-9">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
          Clientes Ausentes
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes Ausentes — {clientes.length} cliente(s) sem compra há {meses}+ meses</DialogTitle>
          </DialogHeader>

          {clientes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum cliente inativo encontrado no período.</p>
          ) : (
            <div className="space-y-4">
              {clientes.map((c) => (
                <div key={c.cliente_id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Última compra: {new Date(c.ultima_compra).toLocaleDateString("pt-BR")}
                        {c.lid && <span className="ml-2">• LID: {c.lid}</span>}
                      </p>
                    </div>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {c.produtos.length} produto(s)
                    </span>
                  </div>
                  <div className="grid gap-1">
                    {c.produtos.slice(0, 5).map((pr) => (
                      <div key={pr.produto_id} className="flex justify-between text-sm text-muted-foreground">
                        <span>{pr.nome}</span>
                        <span>{pr.quantidade_total}x — R$ {pr.preco.toFixed(2)}</span>
                      </div>
                    ))}
                    {c.produtos.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{c.produtos.length - 5} produto(s)</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={sendWebhook} disabled={sending || clientes.length === 0} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando..." : "Enviar via Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientesInativosRelatorio;
