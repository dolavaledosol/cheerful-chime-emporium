import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, UserX, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

const ClientesInativosRelatorio = ({ inline = false }: { inline?: boolean }) => {
  const [meses, setMeses] = useState(3);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientes, setClientes] = useState<ClienteInativo[]>([]);
  const [fetched, setFetched] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

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
      setFetched(true);
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
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Erro ao enviar relatório de clientes", err);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleOpen = () => {
    setFetched(false);
    setClientes([]);
    setDialogOpen(true);
  };

  const content = (
    <>
      {/* Filter bar */}
      <div className="flex items-end gap-3 pb-3 border-b">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Meses sem compra</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={meses}
            onChange={(e) => { setMeses(Number(e.target.value) || 3); setFetched(false); }}
            className="w-20 h-11"
          />
        </div>
        <Button onClick={fetchRelatorio} disabled={loading} className="gap-2 h-11">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </Button>
        {fetched && (
          <span className="text-sm text-muted-foreground ml-auto hidden sm:inline">
            {clientes.length} encontrado(s)
          </span>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!fetched ? (
          <p className="text-muted-foreground text-center py-12 text-sm">
            Defina o período e clique em Buscar.
          </p>
        ) : clientes.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 text-sm">
            Nenhum cliente inativo no período.
          </p>
        ) : (
          <div className="space-y-2 py-2">
            {fetched && isMobile && (
              <p className="text-xs text-muted-foreground">{clientes.length} cliente(s)</p>
            )}
            {clientes.map((c) => (
              <div key={c.cliente_id} className="border rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Última compra: {new Date(c.ultima_compra).toLocaleDateString("pt-BR")}
                      {c.lid && <span className="ml-2">• LID: {c.lid}</span>}
                    </p>
                  </div>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {c.produtos.length} prod.
                  </span>
                </div>
                <div className="grid gap-1.5">
                  {c.produtos.map((pr) => (
                    <div key={pr.produto_id} className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg p-1.5">
                      {pr.url_imagem ? (
                        <img src={pr.url_imagem} alt={pr.nome} className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{pr.nome}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {pr.fabricante && <span>{pr.fabricante} • </span>}
                          {pr.peso && <span>{pr.peso}{pr.unidade_medida} • </span>}
                          {pr.quantidade_total}x comprado
                        </p>
                      </div>
                      <span className="text-[10px] shrink-0 tabular-nums">
                        R$ {pr.preco.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send */}
      <div className="flex justify-end gap-2 border-t pt-3">
        {!inline && <Button variant="outline" onClick={() => setDialogOpen(false)}>Fechar</Button>}
        <Button onClick={sendWebhook} disabled={sending || !fetched || clientes.length === 0} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Enviando..." : "Enviar Webhook"}
        </Button>
      </div>
    </>
  );

  if (inline) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen} size={isMobile ? "icon" : "default"} className="gap-2 shrink-0">
        <UserX className="h-4 w-4" />
        {!isMobile && "Clientes Ausentes"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Clientes Ausentes</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientesInativosRelatorio;
