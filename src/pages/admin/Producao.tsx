import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, AlertTriangle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ProdItem {
  produto_id: string;
  quantidade: number;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Producao = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can("producao" as any, "editar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [produtoId, setProdutoId] = useState("");
  const [receitaId, setReceitaId] = useState("");
  const [localEstoqueId, setLocalEstoqueId] = useState("");
  const [qtdProduzir, setQtdProduzir] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ProdItem[]>([]);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("produto").select("produto_id, nome, unidade_medida").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["locais-estoque-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("local_estoque").select("local_estoque_id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: receitas = [] } = useQuery({
    queryKey: ["receitas-ativas"],
    queryFn: async () => {
      const { data } = await supabase.from("receita").select("*, receita_item(*)").eq("ativo", true);
      return data || [];
    },
  });

  const { data: estoquesLocal = [] } = useQuery({
    queryKey: ["estoques-local-all"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_local").select("produto_id, local_estoque_id, quantidade_disponivel, preco_custo");
      return data || [];
    },
  });

  const { data: historico = [], isLoading: historicoLoading } = useQuery({
    queryKey: ["producao-historico"],
    queryFn: async () => {
      const { data } = await supabase
        .from("producao")
        .select("*, producao_item(*)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const produtoMap = Object.fromEntries(produtos.map((p) => [p.produto_id, p]));
  const localMap = Object.fromEntries(locais.map((l) => [l.local_estoque_id, l]));

  const receitasForProduto = receitas.filter((r: any) => r.produto_id === produtoId);

  const getEstoque = (pid: string) => {
    const e = estoquesLocal.find((el) => el.produto_id === pid && el.local_estoque_id === localEstoqueId);
    return e?.quantidade_disponivel ?? 0;
  };

  const getCusto = (pid: string): number => {
    const e = estoquesLocal.find((el) => el.produto_id === pid && el.local_estoque_id === localEstoqueId);
    return Number(e?.preco_custo ?? 0);
  };

  // Calculate total production cost
  const custoTotal = useMemo(() => {
    return itens.reduce((sum, item) => {
      if (!item.produto_id || !localEstoqueId) return sum;
      return sum + getCusto(item.produto_id) * item.quantidade;
    }, 0);
  }, [itens, localEstoqueId, estoquesLocal]);

  const custoUnitario = qtdProduzir > 0 ? custoTotal / qtdProduzir : 0;

  const selectReceita = (rid: string) => {
    setReceitaId(rid);
    const rec = receitas.find((r: any) => r.receita_id === rid) as any;
    if (rec?.receita_item) {
      setItens(rec.receita_item.map((i: any) => ({
        produto_id: i.produto_id,
        quantidade: Number(i.quantidade) * qtdProduzir,
      })));
    }
  };

  const onQtdChange = (newQtd: number) => {
    const oldQtd = qtdProduzir;
    setQtdProduzir(newQtd);
    if (receitaId && oldQtd > 0) {
      const ratio = newQtd / oldQtd;
      setItens((prev) => prev.map((i) => ({ ...i, quantidade: Math.round(i.quantidade * ratio * 100) / 100 })));
    }
  };

  const addItem = () => setItens((prev) => [...prev, { produto_id: "", quantidade: 1 }]);
  const removeItem = (idx: number) => setItens((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) =>
    setItens((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const hasStockIssues = itens.some((i) => i.produto_id && getEstoque(i.produto_id) < i.quantidade);

  const producaoMutation = useMutation({
    mutationFn: async () => {
      const { data: prod } = await supabase.from("producao").insert({
        produto_id: produtoId,
        receita_id: receitaId || null,
        local_estoque_id: localEstoqueId,
        quantidade_produzida: qtdProduzir,
        custo_total: custoTotal,
        observacao: observacao || null,
        usuario_id: user?.id || null,
      }).select("producao_id").single().throwOnError();

      if (itens.length > 0) {
        await supabase.from("producao_item").insert(
          itens.map((i) => ({ producao_id: prod!.producao_id, produto_id: i.produto_id, quantidade: i.quantidade }))
        ).throwOnError();
      }

      // Deduct ingredients
      for (const item of itens) {
        const estoque = estoquesLocal.find(
          (el) => el.produto_id === item.produto_id && el.local_estoque_id === localEstoqueId
        );
        if (estoque) {
          await supabase.from("estoque_local")
            .update({ quantidade_disponivel: Number(estoque.quantidade_disponivel) - item.quantidade })
            .eq("produto_id", item.produto_id)
            .eq("local_estoque_id", localEstoqueId)
            .throwOnError();
        }
        await supabase.from("movimentacao_estoque").insert({
          produto_id: item.produto_id,
          local_estoque_id: localEstoqueId,
          tipo: "saida_producao",
          quantidade: item.quantidade,
          documento: prod!.producao_id,
          observacao: `Produção: ${produtoMap[produtoId]?.nome || produtoId}`,
          usuario_id: user?.id || null,
        }).throwOnError();
      }

      // Add finished product
      const estoqueFinal = estoquesLocal.find(
        (el) => el.produto_id === produtoId && el.local_estoque_id === localEstoqueId
      );
      if (estoqueFinal) {
        await supabase.from("estoque_local")
          .update({ quantidade_disponivel: Number(estoqueFinal.quantidade_disponivel) + qtdProduzir })
          .eq("produto_id", produtoId)
          .eq("local_estoque_id", localEstoqueId)
          .throwOnError();
      } else {
        await supabase.from("estoque_local").insert({
          produto_id: produtoId,
          local_estoque_id: localEstoqueId,
          quantidade_disponivel: qtdProduzir,
          preco: 0,
        }).throwOnError();
      }

      await supabase.from("movimentacao_estoque").insert({
        produto_id: produtoId,
        local_estoque_id: localEstoqueId,
        tipo: "entrada_producao",
        quantidade: qtdProduzir,
        documento: prod!.producao_id,
        observacao: `Produção de ${qtdProduzir}x ${produtoMap[produtoId]?.nome || ""}`,
        usuario_id: user?.id || null,
      }).throwOnError();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao-historico"] });
      qc.invalidateQueries({ queryKey: ["estoques-local-all"] });
      setDialogOpen(false);
      toast.success("Produção registrada com sucesso!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // Cancel production: reverse all stock movements
  const cancelMutation = useMutation({
    mutationFn: async (prod: any) => {
      // Re-fetch current stock for accurate values
      const ingredientIds = (prod.producao_item || []).map((i: any) => i.produto_id);
      const allIds = [...ingredientIds, prod.produto_id];

      const { data: currentEstoques } = await supabase
        .from("estoque_local")
        .select("produto_id, local_estoque_id, quantidade_disponivel")
        .eq("local_estoque_id", prod.local_estoque_id)
        .in("produto_id", allIds);

      const estoqueMap = Object.fromEntries(
        (currentEstoques || []).map((e) => [`${e.produto_id}_${e.local_estoque_id}`, e])
      );

      // Return ingredients to stock
      for (const item of (prod.producao_item || [])) {
        const key = `${item.produto_id}_${prod.local_estoque_id}`;
        const est = estoqueMap[key];
        if (est) {
          await supabase.from("estoque_local")
            .update({ quantidade_disponivel: Number(est.quantidade_disponivel) + Number(item.quantidade) })
            .eq("produto_id", item.produto_id)
            .eq("local_estoque_id", prod.local_estoque_id)
            .throwOnError();
        }
        await supabase.from("movimentacao_estoque").insert({
          produto_id: item.produto_id,
          local_estoque_id: prod.local_estoque_id,
          tipo: "entrada_cancelamento_producao",
          quantidade: Number(item.quantidade),
          documento: prod.producao_id,
          observacao: `Cancelamento produção: ${produtoMap[prod.produto_id]?.nome || ""}`,
          usuario_id: user?.id || null,
        }).throwOnError();
      }

      // Remove finished product from stock
      const keyFinal = `${prod.produto_id}_${prod.local_estoque_id}`;
      const estFinal = estoqueMap[keyFinal];
      if (estFinal) {
        await supabase.from("estoque_local")
          .update({ quantidade_disponivel: Math.max(0, Number(estFinal.quantidade_disponivel) - Number(prod.quantidade_produzida)) })
          .eq("produto_id", prod.produto_id)
          .eq("local_estoque_id", prod.local_estoque_id)
          .throwOnError();
      }
      await supabase.from("movimentacao_estoque").insert({
        produto_id: prod.produto_id,
        local_estoque_id: prod.local_estoque_id,
        tipo: "saida_cancelamento_producao",
        quantidade: Number(prod.quantidade_produzida),
        documento: prod.producao_id,
        observacao: `Cancelamento produção de ${prod.quantidade_produzida}x ${produtoMap[prod.produto_id]?.nome || ""}`,
        usuario_id: user?.id || null,
      }).throwOnError();

      // Mark as cancelled
      await supabase.from("producao")
        .update({ cancelado: true })
        .eq("producao_id", prod.producao_id)
        .throwOnError();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao-historico"] });
      qc.invalidateQueries({ queryKey: ["estoques-local-all"] });
      toast.success("Produção cancelada e estoque revertido!");
    },
    onError: (e: any) => toast.error("Erro ao cancelar: " + e.message),
  });

  const openNew = () => {
    setProdutoId("");
    setReceitaId("");
    setLocalEstoqueId("");
    setQtdProduzir(1);
    setObservacao("");
    setItens([]);
    setDialogOpen(true);
  };

  const valid = produtoId && localEstoqueId && qtdProduzir > 0 && itens.length > 0 && itens.every((i) => i.produto_id && i.quantidade > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produção</h1>
          <p className="text-muted-foreground text-sm">Registre fabricações e acompanhe o histórico</p>
        </div>
        {canEdit && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Produção</Button>
        )}
      </div>

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="historico">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto Fabricado</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Custo Total</TableHead>
                  <TableHead>Ingredientes</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-20">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : historico.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma produção registrada</TableCell></TableRow>
                ) : (
                  historico.map((p: any) => (
                    <TableRow key={p.producao_id} className={p.cancelado ? "opacity-50" : ""}>
                      <TableCell className="whitespace-nowrap">{format(new Date(p.created_at), "dd/MM/yy HH:mm")}</TableCell>
                      <TableCell className="font-medium">{produtoMap[p.produto_id]?.nome || p.produto_id}</TableCell>
                      <TableCell>{p.quantidade_produzida}</TableCell>
                      <TableCell>{localMap[p.local_estoque_id]?.nome || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {Number(p.custo_total) > 0 ? formatBRL(Number(p.custo_total)) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(p.producao_item || []).map((i: any) => (
                            <Badge key={i.producao_item_id} variant="secondary" className="text-xs">
                              {i.quantidade}x {produtoMap[i.produto_id]?.nome || "?"}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.cancelado ? (
                          <Badge variant="destructive">Cancelado</Badge>
                        ) : (
                          <Badge variant="default">Concluído</Badge>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          {!p.cancelado && (
                            <Button size="icon" variant="ghost" className="text-destructive"
                              title="Cancelar produção e reverter estoque"
                              disabled={cancelMutation.isPending}
                              onClick={() => {
                                if (confirm("Cancelar esta produção? O estoque será revertido (ingredientes devolvidos e produto fabricado removido).")) {
                                  cancelMutation.mutate(p);
                                }
                              }}>
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Production Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Produção</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Produto a Fabricar *</Label>
                <Select value={produtoId} onValueChange={(v) => { setProdutoId(v); setReceitaId(""); setItens([]); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.produto_id} value={p.produto_id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Local de Estoque *</Label>
                <Select value={localEstoqueId} onValueChange={setLocalEstoqueId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {locais.map((l) => (
                      <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade a Produzir *</Label>
                <Input type="number" min={1} step={1} value={qtdProduzir}
                  onChange={(e) => onQtdChange(Math.max(1, Number(e.target.value)))} />
              </div>

              {produtoId && receitasForProduto.length > 0 && (
                <div className="space-y-2">
                  <Label>Receita Base</Label>
                  <Select value={receitaId} onValueChange={selectReceita}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma receita (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {receitasForProduto.map((r: any) => (
                        <SelectItem key={r.receita_id} value={r.receita_id}>{r.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredientes Utilizados *</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />Adicionar
                </Button>
              </div>

              {itens.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  {produtoId && receitasForProduto.length > 0
                    ? "Selecione uma receita ou adicione ingredientes manualmente"
                    : "Adicione os ingredientes consumidos"}
                </p>
              )}

              {itens.map((item, idx) => {
                const estoqueDisp = item.produto_id && localEstoqueId ? getEstoque(item.produto_id) : null;
                const insufficient = estoqueDisp !== null && estoqueDisp < item.quantidade;
                const custoItem = item.produto_id && localEstoqueId ? getCusto(item.produto_id) * item.quantidade : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Select value={item.produto_id} onValueChange={(v) => updateItem(idx, "produto_id", v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                        <SelectContent>
                          {produtos
                            .filter((p) => p.produto_id !== produtoId)
                            .map((p) => (
                              <SelectItem key={p.produto_id} value={p.produto_id}>{p.nome}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" min={0.1} step={0.1} className="w-24"
                        value={item.quantidade} onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))} />
                      <span className="text-xs text-muted-foreground w-8">
                        {produtoMap[item.produto_id]?.unidade_medida || ""}
                      </span>
                      <span className="text-xs font-medium w-20 text-right whitespace-nowrap">
                        {custoItem > 0 ? formatBRL(custoItem) : "-"}
                      </span>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {item.produto_id && localEstoqueId && (
                      <div className={`text-xs pl-1 ${insufficient ? "text-destructive" : "text-muted-foreground"}`}>
                        {insufficient && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                        Estoque: {estoqueDisp} | Custo unit.: {getCusto(item.produto_id) > 0 ? formatBRL(getCusto(item.produto_id)) : "não definido"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cost Summary */}
            {itens.length > 0 && localEstoqueId && (
              <div className="bg-muted/50 border rounded-md p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo total dos ingredientes:</span>
                  <span className="font-semibold">{formatBRL(custoTotal)}</span>
                </div>
                {qtdProduzir > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo unitário por produto:</span>
                    <span className="font-medium">{formatBRL(custoUnitario)}</span>
                  </div>
                )}
                {custoTotal === 0 && itens.some((i) => i.produto_id) && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Alguns ingredientes não possuem preço de custo cadastrado neste local
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)}
                placeholder="Anotações sobre esta produção..." rows={2} />
            </div>

            {hasStockIssues && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">Atenção: Alguns ingredientes possuem estoque insuficiente. A produção será registrada mesmo assim.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!valid || producaoMutation.isPending} onClick={() => producaoMutation.mutate()}>
              {producaoMutation.isPending ? "Registrando..." : "Confirmar Produção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Producao;
