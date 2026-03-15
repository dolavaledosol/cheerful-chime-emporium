import React, { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, ArrowRightLeft, Download, Upload, CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import EstoqueRelatorio from "@/components/admin/EstoqueRelatorio";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface EstoqueRow {
  estoque_local_id: string;
  produto_id: string;
  local_estoque_id: string;
  preco: number;
  preco_custo: number;
  preco_promocional: number | null;
  quantidade_disponivel: number;
  quantidade_pedida_nao_separada: number;
  produto: { nome: string; preco: number; peso_liquido: number | null; unidade_medida: string; fabricante: { nome: string } | null; familia: { nome: string } | null } | null;
  local_estoque: { nome: string } | null;
}
interface LocalEstoque { local_estoque_id: string; nome: string; }
interface SelectOption { id: string; nome: string; }
interface ProdutoAgrupado {
  produto_id: string; nome: string; fabricante: string; familia: string;
  locais: Record<string, { estoque: number; pedidos: number; estoque_local_id: string }>;
  totalEstoque: number; totalPedidos: number;
}

/* ── Transfer line type ── */
interface TransferLinha {
  produto_id: string;
  nome: string;
  fabricante: string;
  peso_liquido: number | null;
  unidade_medida: string;
  checked: boolean;
  quantidade: string;
  disponivel: number;
  estoqueDestino: number;
}

/* ── Movimentação row ── */
interface MovimentacaoRow {
  movimentacao_estoque_id: string;
  tipo: string;
  documento: string | null;
  quantidade: number;
  created_at: string;
  usuario_id: string | null;
  usuario_nome?: string;
  produto: { produto_id: string; nome: string; peso_liquido: number | null; unidade_medida: string; fabricante: { nome: string } | null; familia: { nome: string } | null } | null;
  local_estoque: { nome: string } | null;
  local_estoque_destino: { nome: string } | null;
}

const emptyForm = {
  produto_id: "", local_estoque_id: "", preco: "", preco_promocional: "",
  quantidade_disponivel: "", quantidade_pedida_nao_separada: "0",
};

const Estoque = () => {
  const [items, setItems] = useState<EstoqueRow[]>([]);
  const [produtos, setProdutos] = useState<SelectOption[]>([]);
  const [locais, setLocais] = useState<LocalEstoque[]>([]);
  const [search, setSearch] = useState("");
  const [estoqueLocalFilter, setEstoqueLocalFilter] = useState("todos");
  const [estoqueTipoFilter, setEstoqueTipoFilter] = useState<"ambos" | "estoque" | "pedidos">("ambos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  /* ── Transfer state ── */
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferOrigem, setTransferOrigem] = useState("");
  const [transferDestino, setTransferDestino] = useState("");
  const [transferLinhas, setTransferLinhas] = useState<TransferLinha[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSearchProd, setTransferSearchProd] = useState("");

  /* ── Movimentação state ── */
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoRow[]>([]);
  const [movSearch, setMovSearch] = useState("");
  const [movFilterLocal, setMovFilterLocal] = useState("all");
  const [movFilterFabricante, setMovFilterFabricante] = useState("all");
  const [movFilterTipo, setMovFilterTipo] = useState("all");
  const [movDateFrom, setMovDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [movDateTo, setMovDateTo] = useState<Date>(endOfMonth(new Date()));

  /* ── Conciliação unificada state ── */
  const [conciliacaoOpen, setConciliacaoOpen] = useState(false);
  const [conciliacaoLoading, setConciliacaoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface ConciliacaoUnificadaLinha {
    produto_id: string; nome: string; local: string; local_estoque_id: string;
    estoque_local_id: string | null;
    hasEstoque: boolean;
    estoque_sistema: number; estoque_fisico: number; diferenca_estoque: number;
    hasPedidos: boolean;
    pedidos_sistema: number; pedidos_fisico: number; diferenca_pedidos: number;
  }
  const [conciliacaoLinhas, setConciliacaoLinhas] = useState<ConciliacaoUnificadaLinha[]>([]);

  const load = async () => {
    const [{ data: est }, { data: prod }, { data: loc }] = await Promise.all([
      supabase.from("estoque_local").select("*, produto(nome, preco, peso_liquido, unidade_medida, fabricante(nome), familia(nome)), local_estoque(nome)").order("produto_id"),
      supabase.from("produto").select("produto_id, nome").eq("ativo", true).order("nome"),
      supabase.from("local_estoque").select("local_estoque_id, nome").eq("ativo", true).order("nome"),
    ]);
    if (est) setItems(est as any);
    if (prod) setProdutos(prod.map((p) => ({ id: p.produto_id, nome: p.nome })));
    if (loc) setLocais(loc as LocalEstoque[]);
  };

  const loadMovimentacoes = async (dateFrom?: Date, dateTo?: Date) => {
    const from = dateFrom || movDateFrom;
    const to = dateTo || movDateTo;
    let query = supabase
      .from("movimentacao_estoque")
      .select("movimentacao_estoque_id, tipo, documento, quantidade, created_at, usuario_id, produto(produto_id, nome, peso_liquido, unidade_medida, fabricante(nome), familia(nome)), local_estoque:local_estoque_id(nome), local_estoque_destino:local_estoque_destino_id(nome)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (from) query = query.gte("created_at", from.toISOString());
    if (to) {
      const endOfDay = new Date(to);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endOfDay.toISOString());
    }
    const { data } = await query;
    if (data) {
      const userIds = [...new Set((data as any[]).map((m: any) => m.usuario_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("profile_id, nome").in("profile_id", userIds);
        if (profiles) {
          profiles.forEach((p: any) => { profileMap[p.profile_id] = p.nome; });
        }
      }
      setMovimentacoes((data as any[]).map((m: any) => ({ ...m, usuario_nome: profileMap[m.usuario_id] || "" })));
    }
  };

  /* ═══════════════════  EXPORTAÇÃO UNIFICADA  ═══════════════════ */
  const exportExcel = async () => {
    const { data: allProdutos } = await supabase
      .from("produto")
      .select("produto_id, nome, fabricante(nome), familia(nome)")
      .eq("ativo", true)
      .order("nome");
    if (!allProdutos) return;

    const rows: any[] = [];
    for (const p of allProdutos as any[]) {
      const row: any = {
        produto_id: p.produto_id,
        produto: p.nome,
        fabricante: p.fabricante?.nome || "",
        familia: p.familia?.nome || "",
      };
      for (const l of locais) {
        const estItem = items.find((i) => i.produto_id === p.produto_id && i.local_estoque_id === l.local_estoque_id);
        row[`${l.nome} Est. (${l.local_estoque_id})`] = estItem ? Number(estItem.quantidade_disponivel) : 0;
        row[`${l.nome} Ped. (${l.local_estoque_id})`] = estItem ? Number(estItem.quantidade_pedida_nao_separada) : 0;
      }
      rows.push(row);
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, `estoque_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Planilha exportada com sucesso" });
  };

  /* ═══════════════════  IMPORTAÇÃO UNIFICADA  ═══════════════════ */
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws);

    const headers = Object.keys(rows[0] || {});
    // Detect columns: "LocalName Est. (uuid)" and "LocalName Ped. (uuid)"
    const estColumns = headers.filter((h) => /\bEst\.\s*\([0-9a-f-]{36}\)$/.test(h));
    const pedColumns = headers.filter((h) => /\bPed\.\s*\([0-9a-f-]{36}\)$/.test(h));
    // Also support old format without Est./Ped. prefix (plain "(uuid)")
    const plainColumns = headers.filter((h) => /\(([0-9a-f-]{36})\)$/.test(h) && !estColumns.includes(h) && !pedColumns.includes(h));

    if (estColumns.length === 0 && pedColumns.length === 0 && plainColumns.length === 0) {
      toast({ title: "Formato inválido", description: "Nenhuma coluna de local de estoque encontrada.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const extractLocalId = (colName: string) => {
      const match = colName.match(/\(([0-9a-f-]{36})\)$/);
      return match ? match[1] : null;
    };

    const linhaMap = new Map<string, ConciliacaoUnificadaLinha>();
    const getKey = (prodId: string, localId: string) => `${prodId}|${localId}`;

    for (const row of rows) {
      const prodId = row.produto_id;
      if (!prodId) continue;

      // Process Est. columns
      for (const colName of estColumns) {
        const localId = extractLocalId(colName);
        if (!localId) continue;
        const key = getKey(prodId, localId);
        const sysItem = items.find((i) => i.produto_id === prodId && i.local_estoque_id === localId);
        const estoqueFisico = Number(row[colName] ?? 0);
        const estoqueSistema = sysItem ? Number(sysItem.quantidade_disponivel) : 0;
        const localNome = locais.find((l) => l.local_estoque_id === localId)?.nome || localId;

        if (!linhaMap.has(key)) {
          linhaMap.set(key, {
            produto_id: prodId, nome: sysItem?.produto?.nome || row.produto || prodId,
            local: localNome, local_estoque_id: localId,
            estoque_local_id: sysItem?.estoque_local_id || null,
            hasEstoque: false, estoque_sistema: estoqueSistema, estoque_fisico: 0, diferenca_estoque: 0,
            hasPedidos: false, pedidos_sistema: sysItem ? Number(sysItem.quantidade_pedida_nao_separada) : 0, pedidos_fisico: 0, diferenca_pedidos: 0,
          });
        }
        const linha = linhaMap.get(key)!;
        linha.hasEstoque = true;
        linha.estoque_fisico = estoqueFisico;
        linha.diferenca_estoque = estoqueFisico - linha.estoque_sistema;
      }

      // Process Ped. columns
      for (const colName of pedColumns) {
        const localId = extractLocalId(colName);
        if (!localId) continue;
        const key = getKey(prodId, localId);
        const sysItem = items.find((i) => i.produto_id === prodId && i.local_estoque_id === localId);
        const pedidosFisico = Number(row[colName] ?? 0);
        const pedidosSistema = sysItem ? Number(sysItem.quantidade_pedida_nao_separada) : 0;
        const localNome = locais.find((l) => l.local_estoque_id === localId)?.nome || localId;

        if (!linhaMap.has(key)) {
          linhaMap.set(key, {
            produto_id: prodId, nome: sysItem?.produto?.nome || row.produto || prodId,
            local: localNome, local_estoque_id: localId,
            estoque_local_id: sysItem?.estoque_local_id || null,
            hasEstoque: false, estoque_sistema: sysItem ? Number(sysItem.quantidade_disponivel) : 0, estoque_fisico: 0, diferenca_estoque: 0,
            hasPedidos: false, pedidos_sistema: pedidosSistema, pedidos_fisico: 0, diferenca_pedidos: 0,
          });
        }
        const linha = linhaMap.get(key)!;
        linha.hasPedidos = true;
        linha.pedidos_fisico = pedidosFisico;
        linha.diferenca_pedidos = pedidosFisico - linha.pedidos_sistema;
      }

      // Process old plain columns (treat as estoque only)
      for (const colName of plainColumns) {
        const localId = extractLocalId(colName);
        if (!localId) continue;
        const key = getKey(prodId, localId);
        const sysItem = items.find((i) => i.produto_id === prodId && i.local_estoque_id === localId);
        const estoqueFisico = Number(row[colName] ?? 0);
        const estoqueSistema = sysItem ? Number(sysItem.quantidade_disponivel) : 0;
        const localNome = locais.find((l) => l.local_estoque_id === localId)?.nome || localId;

        if (!linhaMap.has(key)) {
          linhaMap.set(key, {
            produto_id: prodId, nome: sysItem?.produto?.nome || row.produto || prodId,
            local: localNome, local_estoque_id: localId,
            estoque_local_id: sysItem?.estoque_local_id || null,
            hasEstoque: false, estoque_sistema: estoqueSistema, estoque_fisico: 0, diferenca_estoque: 0,
            hasPedidos: false, pedidos_sistema: 0, pedidos_fisico: 0, diferenca_pedidos: 0,
          });
        }
        const linha = linhaMap.get(key)!;
        linha.hasEstoque = true;
        linha.estoque_fisico = estoqueFisico;
        linha.diferenca_estoque = estoqueFisico - linha.estoque_sistema;
      }
    }

    setConciliacaoLinhas(Array.from(linhaMap.values()));
    setConciliacaoOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ═══════════════════  SALVAR CONCILIAÇÃO UNIFICADA  ═══════════════════ */
  const saveConciliacao = async () => {
    const linhasComDif = conciliacaoLinhas.filter((l) => l.diferenca_estoque !== 0 || l.diferenca_pedidos !== 0);
    if (linhasComDif.length === 0) {
      toast({ title: "Nenhuma diferença encontrada" });
      setConciliacaoOpen(false);
      return;
    }
    setConciliacaoLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      for (const linha of linhasComDif) {
        const sysItem = items.find((i) => i.produto_id === linha.produto_id && i.local_estoque_id === linha.local_estoque_id);
        const updates: any = {};
        if (linha.hasEstoque && linha.diferenca_estoque !== 0) {
          updates.quantidade_disponivel = linha.estoque_fisico;
        }
        if (linha.hasPedidos && linha.diferenca_pedidos !== 0) {
          updates.quantidade_pedida_nao_separada = linha.pedidos_fisico;
        }

        if (sysItem) {
          await supabase.from("estoque_local").update(updates).eq("estoque_local_id", sysItem.estoque_local_id);
        } else {
          await supabase.from("estoque_local").insert({
            produto_id: linha.produto_id,
            local_estoque_id: linha.local_estoque_id,
            quantidade_disponivel: linha.hasEstoque ? linha.estoque_fisico : 0,
            quantidade_pedida_nao_separada: linha.hasPedidos ? linha.pedidos_fisico : 0,
            preco: 0,
          });
        }

        // Log movimentação only for estoque changes
        if (linha.hasEstoque && linha.diferenca_estoque !== 0) {
          const tipo = linha.diferenca_estoque > 0 ? "entrada" : "saida";
          await supabase.from("movimentacao_estoque").insert({
            tipo,
            produto_id: linha.produto_id,
            local_estoque_id: linha.local_estoque_id,
            quantidade: Math.abs(linha.diferenca_estoque),
            documento: "Conciliação de estoque",
            usuario_id: session?.user?.id || null,
          });
        }
      }
      toast({ title: `Conciliação aplicada: ${linhasComDif.length} item(ns) ajustado(s)` });
      setConciliacaoOpen(false);
      setConciliacaoLinhas([]);
      load();
      loadMovimentacoes();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setConciliacaoLoading(false);
    }
  };

  useEffect(() => { load(); loadMovimentacoes(); }, []);

  /* ── Agrupados for main table ── */
  const agrupados = useMemo(() => {
    const map = new Map<string, ProdutoAgrupado>();
    const activeLocalIds = new Set(locais.map((l) => l.local_estoque_id));
    items.forEach((e) => {
      // Skip records from inactive locals
      if (!activeLocalIds.has(e.local_estoque_id)) return;
      let grupo = map.get(e.produto_id);
      if (!grupo) {
        grupo = {
          produto_id: e.produto_id, nome: e.produto?.nome || "—",
          fabricante: e.produto?.fabricante?.nome || "—", familia: e.produto?.familia?.nome || "—",
          locais: {}, totalEstoque: 0, totalPedidos: 0,
        };
        map.set(e.produto_id, grupo);
      }
      grupo.locais[e.local_estoque_id] = {
        estoque: e.quantidade_disponivel, pedidos: e.quantidade_pedida_nao_separada,
        estoque_local_id: e.estoque_local_id,
      };
      grupo.totalEstoque += Number(e.quantidade_disponivel);
      grupo.totalPedidos += Number(e.quantidade_pedida_nao_separada);
    });
    return Array.from(map.values());
  }, [items, locais]);

  const filtered = agrupados.filter((g) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return g.nome.toLowerCase().includes(term) || g.fabricante.toLowerCase().includes(term) ||
      g.familia.toLowerCase().includes(term) || g.produto_id.toLowerCase().includes(term);
  });

  /* ── Edit single record ── */
  const openEdit = (e: EstoqueRow) => {
    setEditId(e.estoque_local_id);
    setForm({
      produto_id: e.produto_id, local_estoque_id: e.local_estoque_id,
      preco: String(e.preco), preco_promocional: e.preco_promocional != null ? String(e.preco_promocional) : "",
      quantidade_disponivel: String(e.quantidade_disponivel),
      quantidade_pedida_nao_separada: String(e.quantidade_pedida_nao_separada),
    });
    setDialogOpen(true);
  };
  const openEditById = (estoque_local_id: string) => {
    const item = items.find((i) => i.estoque_local_id === estoque_local_id);
    if (item) openEdit(item);
  };
  const save = async () => {
    setLoading(true);
    const payload = {
      produto_id: form.produto_id, local_estoque_id: form.local_estoque_id,
      preco: Number(form.preco), preco_promocional: form.preco_promocional ? Number(form.preco_promocional) : null,
      quantidade_disponivel: Number(form.quantidade_disponivel),
      quantidade_pedida_nao_separada: Number(form.quantidade_pedida_nao_separada),
    };
    const { error } = editId
      ? await supabase.from("estoque_local").update(payload).eq("estoque_local_id", editId)
      : await supabase.from("estoque_local").insert(payload);
    setLoading(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Estoque atualizado" : "Estoque criado" });
    setDialogOpen(false); load();
  };

  /* ═══════════════════  TRANSFERÊNCIA  ═══════════════════ */
  const openTransfer = () => {
    setTransferOrigem(""); setTransferDestino("");
    setTransferLinhas([]); setTransferSearchProd(""); setTransferOpen(true);
  };

  const buildTransferLinhas = (origemId: string, destinoId: string) => {
    const produtosNoLocal = items.filter((e) => e.local_estoque_id === origemId && e.quantidade_disponivel > 0);
    setTransferLinhas(
      produtosNoLocal.map((e) => {
        const destItem = destinoId ? items.find((i) => i.produto_id === e.produto_id && i.local_estoque_id === destinoId) : null;
        return {
          produto_id: e.produto_id,
          nome: e.produto?.nome || "—",
          fabricante: e.produto?.fabricante?.nome || "—",
          peso_liquido: e.produto?.peso_liquido ?? null,
          unidade_medida: e.produto?.unidade_medida || "un",
          checked: false,
          quantidade: "1",
          disponivel: Number(e.quantidade_disponivel),
          estoqueDestino: destItem ? Number(destItem.quantidade_disponivel) : 0,
        };
      })
    );
  };

  const onOrigemChange = (localId: string) => {
    setTransferOrigem(localId);
    buildTransferLinhas(localId, transferDestino);
  };

  const onDestinoChange = (localId: string) => {
    setTransferDestino(localId);
    if (transferOrigem) {
      // Rebuild to update estoqueDestino without losing checked state
      setTransferLinhas((prev) => {
        const produtosNoLocal = items.filter((e) => e.local_estoque_id === transferOrigem && e.quantidade_disponivel > 0);
        return produtosNoLocal.map((e) => {
          const existing = prev.find((p) => p.produto_id === e.produto_id);
          const destItem = items.find((i) => i.produto_id === e.produto_id && i.local_estoque_id === localId);
          return {
            produto_id: e.produto_id,
            nome: e.produto?.nome || "—",
            fabricante: e.produto?.fabricante?.nome || "—",
            peso_liquido: e.produto?.peso_liquido ?? null,
            unidade_medida: e.produto?.unidade_medida || "un",
            checked: existing?.checked || false,
            quantidade: existing?.quantidade || "1",
            disponivel: Number(e.quantidade_disponivel),
            estoqueDestino: destItem ? Number(destItem.quantidade_disponivel) : 0,
          };
        });
      });
    }
  };

  const toggleAllTransfer = (checked: boolean) => {
    const filteredIds = new Set(filteredTransferLinhas.map((l) => l.produto_id));
    setTransferLinhas((prev) =>
      prev.map((l) => filteredIds.has(l.produto_id) ? { ...l, checked } : l)
    );
  };

  const updateTransferLinha = (produto_id: string, field: keyof TransferLinha, value: any) => {
    setTransferLinhas((prev) => prev.map((l) => l.produto_id === produto_id ? { ...l, [field]: value } : l));
  };

  const filteredTransferLinhas = transferLinhas
    .filter((l) => {
      if (!transferSearchProd) return true;
      return l.nome.toLowerCase().includes(transferSearchProd.toLowerCase()) ||
        l.fabricante.toLowerCase().includes(transferSearchProd.toLowerCase());
    })
    .sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? -1 : 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

  const checkedTransferLinhas = transferLinhas.filter((l) => l.checked);

  const saveTransfer = async () => {
    if (!transferOrigem || !transferDestino) { toast({ title: "Selecione origem e destino", variant: "destructive" }); return; }
    if (transferOrigem === transferDestino) { toast({ title: "Origem e destino devem ser diferentes", variant: "destructive" }); return; }
    if (checkedTransferLinhas.length === 0) { toast({ title: "Marque ao menos um produto", variant: "destructive" }); return; }

    // Validate quantities
    for (const l of checkedTransferLinhas) {
      if (Number(l.quantidade) > l.disponivel) {
        toast({ title: `Qtd excede disponível para ${l.nome}`, variant: "destructive" }); return;
      }
      if (Number(l.quantidade) <= 0) {
        toast({ title: `Qtd inválida para ${l.nome}`, variant: "destructive" }); return;
      }
    }

    setTransferLoading(true);
    try {
      for (const linha of checkedTransferLinhas) {
        const qty = Number(linha.quantidade);

        // Subtract from origin
        const origemItem = items.find((i) => i.produto_id === linha.produto_id && i.local_estoque_id === transferOrigem);
        if (origemItem) {
          await supabase.from("estoque_local").update({
            quantidade_disponivel: Number(origemItem.quantidade_disponivel) - qty,
          }).eq("estoque_local_id", origemItem.estoque_local_id);
        }

        // Add to destination (upsert)
        const destItem = items.find((i) => i.produto_id === linha.produto_id && i.local_estoque_id === transferDestino);
        if (destItem) {
          await supabase.from("estoque_local").update({
            quantidade_disponivel: Number(destItem.quantidade_disponivel) + qty,
          }).eq("estoque_local_id", destItem.estoque_local_id);
        } else {
          // Get price info from origin
          const precoVal = origemItem?.preco || 0;
          const custoVal = origemItem?.preco_custo || 0;
          await supabase.from("estoque_local").insert({
            produto_id: linha.produto_id,
            local_estoque_id: transferDestino,
            quantidade_disponivel: qty,
            preco: precoVal,
            preco_custo: custoVal,
          });
        }

        // Log movimentação
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from("movimentacao_estoque").insert({
          tipo: "transferencia",
          produto_id: linha.produto_id,
          local_estoque_id: transferOrigem,
          local_estoque_destino_id: transferDestino,
          quantidade: qty,
          documento: `Transferência`,
          usuario_id: session?.user?.id || null,
        });
      }

      toast({ title: "Transferência realizada com sucesso!" });
      setTransferOpen(false);
      load();
      loadMovimentacoes();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setTransferLoading(false);
    }
  };

  /* ── Movimentação filtered (client-side text/type/local only, dates already filtered at DB level) ── */
  const filteredMov = movimentacoes.filter((m) => {
    if (movFilterLocal !== "all" && m.local_estoque?.nome !== movFilterLocal) return false;
    if (movFilterFabricante !== "all" && m.produto?.fabricante?.nome !== movFilterFabricante) return false;
    if (movFilterTipo !== "all" && m.tipo !== movFilterTipo) return false;
    if (!movSearch) return true;
    const term = movSearch.toLowerCase();
    return (m.produto?.nome || "").toLowerCase().includes(term) ||
      (m.documento || "").toLowerCase().includes(term) ||
      (m.produto?.produto_id || "").toLowerCase().includes(term) ||
      m.tipo.toLowerCase().includes(term);
  });

  const movLocaisUnicos = [...new Set(movimentacoes.map(m => m.local_estoque?.nome).filter(Boolean))] as string[];
  const movFabricantesUnicos = [...new Set(movimentacoes.map(m => m.produto?.fabricante?.nome).filter(Boolean))] as string[];
  const movTiposUnicos = [...new Set(movimentacoes.map(m => m.tipo))];

  const tipoLabel = (tipo: string) => {
    switch (tipo) {
      case "entrada": return <span className="text-green-600 font-medium">Entrada</span>;
      case "saida": return <span className="text-red-600 font-medium">Saída</span>;
      case "transferencia": return <span className="text-blue-600 font-medium">Transferência</span>;
      default: return tipo;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estoque</h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={openTransfer} className="gap-2"><ArrowRightLeft className="h-4 w-4" /> Transferir</Button>
        </div>
      </div>

      <Tabs defaultValue="estoque">
        <TabsList>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="movimentacao">Movimentação</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório</TabsTrigger>
        </TabsList>

        {/* ── Tab Estoque ── */}
        <TabsContent value="estoque" className="space-y-4">
           <div className="flex flex-col sm:flex-row items-center gap-3 flex-wrap">
             <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input placeholder="Buscar produto, fabricante, família..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
             </div>
             <Select value={estoqueLocalFilter} onValueChange={setEstoqueLocalFilter}>
               <SelectTrigger className="w-[180px]"><SelectValue placeholder="Local" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="todos">Todos locais</SelectItem>
                 {locais.map((l) => (
                   <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
             <Select value={estoqueTipoFilter} onValueChange={(v) => setEstoqueTipoFilter(v as any)}>
               <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="ambos">Est. e Ped.</SelectItem>
                 <SelectItem value="estoque">Só Estoque</SelectItem>
                 <SelectItem value="pedidos">Só Pedidos</SelectItem>
               </SelectContent>
             </Select>
             <div className="flex gap-2">
               <Button variant="outline" onClick={exportExcel} className="gap-2"><Download className="h-4 w-4" /> Exportar</Button>
               <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Importar</Button>
               <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
             </div>
           </div>

          <div className="border rounded-lg overflow-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead className="whitespace-nowrap">Cód</TableHead>
                   <TableHead className="whitespace-nowrap">Produto</TableHead>
                   <TableHead className="whitespace-nowrap">Fabricante</TableHead>
                   <TableHead className="whitespace-nowrap">Família</TableHead>
                   {(estoqueLocalFilter === "todos" ? locais : locais.filter(l => l.local_estoque_id === estoqueLocalFilter)).map((l) => (
                     <TableHead key={l.local_estoque_id} className="text-center whitespace-nowrap"
                       colSpan={estoqueTipoFilter === "ambos" ? 2 : 1}>
                       {l.nome}
                     </TableHead>
                   ))}
                   <TableHead className="text-center whitespace-nowrap"
                     colSpan={estoqueTipoFilter === "ambos" ? 2 : 1}>
                     Total
                   </TableHead>
                 </TableRow>
                 {estoqueTipoFilter === "ambos" && (
                   <TableRow>
                     <TableHead /><TableHead /><TableHead /><TableHead />
                     {(estoqueLocalFilter === "todos" ? locais : locais.filter(l => l.local_estoque_id === estoqueLocalFilter)).map((l) => (
                       <React.Fragment key={l.local_estoque_id}>
                         <TableHead className="text-center text-xs whitespace-nowrap">Est.</TableHead>
                         <TableHead className="text-center text-xs whitespace-nowrap">Ped.</TableHead>
                       </React.Fragment>
                     ))}
                     <TableHead className="text-center text-xs whitespace-nowrap">Est.</TableHead>
                     <TableHead className="text-center text-xs whitespace-nowrap">Ped.</TableHead>
                   </TableRow>
                 )}
               </TableHeader>
               <TableBody>
                 {filtered.length === 0 ? (
                   <TableRow><TableCell colSpan={4 + (estoqueLocalFilter === "todos" ? locais.length : 1) * (estoqueTipoFilter === "ambos" ? 2 : 1) + (estoqueTipoFilter === "ambos" ? 2 : 1)} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                 ) : filtered.map((g) => {
                   const visibleLocais = estoqueLocalFilter === "todos" ? locais : locais.filter(l => l.local_estoque_id === estoqueLocalFilter);
                   const totalEst = estoqueLocalFilter === "todos" ? g.totalEstoque : (g.locais[estoqueLocalFilter]?.estoque ?? 0);
                   const totalPed = estoqueLocalFilter === "todos" ? g.totalPedidos : (g.locais[estoqueLocalFilter]?.pedidos ?? 0);
                   return (
                   <TableRow key={g.produto_id}>
                     <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">{g.produto_id.substring(0, 8)}</TableCell>
                     <TableCell className="font-medium whitespace-nowrap">{g.nome}</TableCell>
                     <TableCell className="text-muted-foreground whitespace-nowrap">{g.fabricante}</TableCell>
                     <TableCell className="text-muted-foreground whitespace-nowrap">{g.familia}</TableCell>
                     {visibleLocais.map((l) => {
                       const data = g.locais[l.local_estoque_id];
                       return (
                         <React.Fragment key={l.local_estoque_id}>
                           {(estoqueTipoFilter === "ambos" || estoqueTipoFilter === "estoque") && (
                             <TableCell
                               className={`text-center cursor-pointer hover:bg-muted/50 ${data ? "" : "text-muted-foreground"}`}
                               onClick={() => data && openEditById(data.estoque_local_id)}>
                               {data ? data.estoque : "—"}
                             </TableCell>
                           )}
                           {(estoqueTipoFilter === "ambos" || estoqueTipoFilter === "pedidos") && (
                             <TableCell className={`text-center ${data ? "" : "text-muted-foreground"}`}>
                               {data ? data.pedidos : "—"}
                             </TableCell>
                           )}
                         </React.Fragment>
                       );
                     })}
                     {(estoqueTipoFilter === "ambos" || estoqueTipoFilter === "estoque") && (
                       <TableCell className="text-center font-semibold">{totalEst}</TableCell>
                     )}
                     {(estoqueTipoFilter === "ambos" || estoqueTipoFilter === "pedidos") && (
                       <TableCell className="text-center font-semibold">{totalPed}</TableCell>
                     )}
                   </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
          </div>
        </TabsContent>

        {/* ── Tab Movimentação ── */}
        <TabsContent value="movimentacao" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por produto, documento..." value={movSearch} onChange={(e) => setMovSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadMovimentacoes(); }} className="pl-10" />
            </div>
            <Select value={movFilterLocal} onValueChange={setMovFilterLocal}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Local" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos locais</SelectItem>
                {movLocaisUnicos.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={movFilterFabricante} onValueChange={setMovFilterFabricante}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Fabricante" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fabricantes</SelectItem>
                {movFabricantesUnicos.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={movFilterTipo} onValueChange={setMovFilterTipo}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                {movTiposUnicos.map(t => <SelectItem key={t} value={t}>{tipoLabel(t)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal text-xs", !movDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {movDateFrom ? format(movDateFrom, "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={movDateFrom} onSelect={(d) => { if (d) { setMovDateFrom(d); loadMovimentacoes(d, movDateTo); } }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal text-xs", !movDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {movDateTo ? format(movDateTo, "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={movDateTo} onSelect={(d) => { if (d) { setMovDateTo(d); loadMovimentacoes(movDateFrom, d); } }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead className="whitespace-nowrap">Tipo</TableHead>
                  <TableHead className="whitespace-nowrap">Documento</TableHead>
                  <TableHead className="whitespace-nowrap">Cód</TableHead>
                  <TableHead className="whitespace-nowrap">Nome</TableHead>
                  <TableHead className="whitespace-nowrap">Fabricante</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Peso</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Unid.</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Qtd</TableHead>
                  <TableHead className="whitespace-nowrap">Local Estoque</TableHead>
                  <TableHead className="whitespace-nowrap">Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMov.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma movimentação encontrada</TableCell></TableRow>
                ) : filteredMov.map((m) => (
                  <TableRow key={m.movimentacao_estoque_id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{tipoLabel(m.tipo)}</TableCell>
                    <TableCell className="text-muted-foreground">{m.documento || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">{m.produto?.produto_id?.substring(0, 8) || "—"}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{m.produto?.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{m.produto?.fabricante?.nome || "—"}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{m.produto?.peso_liquido != null ? m.produto.peso_liquido : "—"}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{m.produto?.unidade_medida || "—"}</TableCell>
                    <TableCell className="text-center font-semibold">{m.quantidade}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.local_estoque?.nome || "—"}
                      {m.tipo === "transferencia" && m.local_estoque_destino?.nome && (
                        <span className="text-muted-foreground"> → {m.local_estoque_destino.nome}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{m.usuario_nome || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        {/* ── Tab Relatório ── */}
        <TabsContent value="relatorio">
          <EstoqueRelatorio />
        </TabsContent>
      </Tabs>

      {/* ── Edit single record dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })} disabled={!!editId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Local de Estoque *</Label>
              <Select value={form.local_estoque_id} onValueChange={(v) => setForm({ ...form, local_estoque_id: v })} disabled={!!editId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{locais.map((l) => <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Preço *</Label><Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} /></div>
              <div className="space-y-2"><Label>Preço Promocional</Label><Input type="number" step="0.01" value={form.preco_promocional} onChange={(e) => setForm({ ...form, preco_promocional: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Qtd Disponível *</Label><Input type="number" value={form.quantidade_disponivel} onChange={(e) => setForm({ ...form, quantidade_disponivel: e.target.value })} /></div>
              <div className="space-y-2"><Label>Qtd Pedida Não Sep.</Label><Input type="number" value={form.quantidade_pedida_nao_separada} onChange={(e) => setForm({ ...form, quantidade_pedida_nao_separada: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading || !form.produto_id || !form.local_estoque_id || !form.preco}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════  DIALOG TRANSFERÊNCIA  ═══════════════════ */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transferência de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Local de Origem *</Label>
                <Select value={transferOrigem} onValueChange={onOrigemChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                  <SelectContent>{locais.map((l) => <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Local de Destino *</Label>
                <Select value={transferDestino} onValueChange={onDestinoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                  <SelectContent>{locais.filter((l) => l.local_estoque_id !== transferOrigem).map((l) => <SelectItem key={l.local_estoque_id} value={l.local_estoque_id}>{l.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {transferLinhas.length > 0 && (
              <>
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filtrar produtos..." value={transferSearchProd} onChange={(e) => setTransferSearchProd(e.target.value)} className="pl-10" />
                </div>
                <div className="border rounded-lg overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filteredTransferLinhas.length > 0 && filteredTransferLinhas.every((l) => l.checked)}
                            onCheckedChange={(v) => toggleAllTransfer(!!v)}
                          />
                        </TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Fabricante</TableHead>
                        
                        <TableHead className="text-center">Peso</TableHead>
                        <TableHead className="text-center">Unid.</TableHead>
                        <TableHead className="text-center w-24">Est. Origem</TableHead>
                        <TableHead className="text-center w-24">Est. Destino</TableHead>
                        <TableHead className="w-24">Qtd Transferir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransferLinhas.map((l) => (
                        <TableRow key={l.produto_id} className={l.checked ? "bg-muted/30" : ""}>
                          <TableCell>
                            <Checkbox checked={l.checked} onCheckedChange={(v) => updateTransferLinha(l.produto_id, "checked", !!v)} />
                          </TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{l.fabricante}</TableCell>
                          
                          <TableCell className="text-center text-muted-foreground">{l.peso_liquido != null ? l.peso_liquido : "—"}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{l.unidade_medida}</TableCell>
                          <TableCell className="text-center font-semibold">{l.disponivel}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{transferDestino ? l.estoqueDestino : "—"}</TableCell>
                          <TableCell>
                            <Input type="number" min="1" max={l.disponivel} value={l.quantidade} onChange={(e) => updateTransferLinha(l.produto_id, "quantidade", e.target.value)} className="h-8" disabled={!l.checked} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between text-sm border-t pt-3">
                  <span className="text-muted-foreground">{checkedTransferLinhas.length} produto(s) selecionado(s)</span>
                </div>
              </>
            )}

            {transferOrigem && transferLinhas.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nenhum produto com estoque disponível neste local.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button onClick={saveTransfer} disabled={transferLoading || checkedTransferLinhas.length === 0 || !transferOrigem || !transferDestino}>
              {transferLoading ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════  DIALOG CONCILIAÇÃO  ═══════════════════ */}
      <Dialog open={conciliacaoOpen} onOpenChange={setConciliacaoOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Conciliação de Estoque</DialogTitle></DialogHeader>
          {conciliacaoLinhas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum dado importado.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {conciliacaoLinhas.filter((l) => l.diferenca_estoque !== 0 || l.diferenca_pedidos !== 0).length} item(ns) com diferença de {conciliacaoLinhas.length} importado(s).
              </p>
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Local</TableHead>
                      {conciliacaoLinhas.some((l) => l.hasEstoque) && (
                        <>
                          <TableHead className="text-center">Est. Sistema</TableHead>
                          <TableHead className="text-center">Est. Físico</TableHead>
                          <TableHead className="text-center">Dif. Est.</TableHead>
                        </>
                      )}
                      {conciliacaoLinhas.some((l) => l.hasPedidos) && (
                        <>
                          <TableHead className="text-center">Ped. Sistema</TableHead>
                          <TableHead className="text-center">Ped. Planilha</TableHead>
                          <TableHead className="text-center">Dif. Ped.</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conciliacaoLinhas.map((l) => {
                      const hasDif = l.diferenca_estoque !== 0 || l.diferenca_pedidos !== 0;
                      return (
                        <TableRow key={`${l.produto_id}-${l.local_estoque_id}`} className={hasDif ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{l.local}</TableCell>
                          {conciliacaoLinhas.some((ll) => ll.hasEstoque) && (
                            <>
                              <TableCell className="text-center">{l.hasEstoque ? l.estoque_sistema : "—"}</TableCell>
                              <TableCell className="text-center">{l.hasEstoque ? l.estoque_fisico : "—"}</TableCell>
                              <TableCell className={`text-center font-semibold ${l.diferenca_estoque > 0 ? "text-green-600" : l.diferenca_estoque < 0 ? "text-red-600" : ""}`}>
                                {l.hasEstoque ? (l.diferenca_estoque > 0 ? `+${l.diferenca_estoque}` : l.diferenca_estoque) : "—"}
                              </TableCell>
                            </>
                          )}
                          {conciliacaoLinhas.some((ll) => ll.hasPedidos) && (
                            <>
                              <TableCell className="text-center">{l.hasPedidos ? l.pedidos_sistema : "—"}</TableCell>
                              <TableCell className="text-center">{l.hasPedidos ? l.pedidos_fisico : "—"}</TableCell>
                              <TableCell className={`text-center font-semibold ${l.diferenca_pedidos > 0 ? "text-green-600" : l.diferenca_pedidos < 0 ? "text-red-600" : ""}`}>
                                {l.hasPedidos ? (l.diferenca_pedidos > 0 ? `+${l.diferenca_pedidos}` : l.diferenca_pedidos) : "—"}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConciliacaoOpen(false)}>Cancelar</Button>
            <Button onClick={saveConciliacao} disabled={conciliacaoLoading || conciliacaoLinhas.filter((l) => l.diferenca_estoque !== 0 || l.diferenca_pedidos !== 0).length === 0}>
              {conciliacaoLoading ? "Aplicando..." : "Aplicar Conciliação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
