import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CatalogHeader from "@/components/catalog/CatalogHeader";
import CatalogFilters from "@/components/catalog/CatalogFilters";
import ProductCard from "@/components/catalog/ProductCard";
import PullToRefresh from "@/components/shared/PullToRefresh";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Search as SearchIcon } from "lucide-react";

interface ProdutoComPreco {
  produto_id: string;
  nome: string;
  slug: string | null;
  descricao: string | null;
  familia_id: string | null;
  fabricante_id: string | null;
  familia_nome: string | null;
  fabricante_nome: string | null;
  preco: number;
  url_imagem: string | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  unidade_medida: string;
  aceita_fracionado: boolean;
  quantidade_default: number;
}

const ProductSkeleton = () => (
  <div className="bg-card rounded-xl overflow-hidden border border-border/50">
    <Skeleton className="aspect-square w-full rounded-none" />
    <div className="p-3 space-y-2">
      <Skeleton className="h-2.5 w-16 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="h-6 w-24 rounded" />
    </div>
  </div>
);

const Index = () => {
  const [search, setSearch] = useState("");
  const [selectedFamilia, setSelectedFamilia] = useState("all");
  const [selectedFabricante, setSelectedFabricante] = useState("all");
  const [produtos, setProdutos] = useState<ProdutoComPreco[]>([]);
  const [familias, setFamilias] = useState<{ id: string; nome: string; familia_pai_id: string | null }[]>([]);
  const [fabricantes, setFabricantes] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFilters = async () => {
      const [famRes, fabRes] = await Promise.all([
        supabase.from("familia").select("familia_id, nome, familia_pai_id").eq("ativo", true).order("nome"),
        supabase.from("fabricante").select("fabricante_id, nome").eq("ativo", true).order("nome"),
      ]);
      if (famRes.data) setFamilias(famRes.data.map((f) => ({ id: f.familia_id, nome: f.nome, familia_pai_id: f.familia_pai_id })));
      if (fabRes.data) setFabricantes(fabRes.data.map((f) => ({ id: f.fabricante_id, nome: f.nome })));
    };
    loadFilters();
  }, []);

  const loadProdutos = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("produto")
      .select(`
        produto_id, nome, slug, descricao, preco, peso_bruto, peso_liquido,
        unidade_medida, aceita_fracionado, quantidade_default, familia_id, fabricante_id,
        familia:familia_id (nome), fabricante:fabricante_id (nome),
        produto_imagem (url_imagem, ordem)
      `)
      .eq("ativo", true)
      .order("nome");

    if (selectedFamilia !== "all") {
      const selectedFam = familias.find((f) => f.id === selectedFamilia);
      const isChild = selectedFam?.familia_pai_id != null;
      if (isChild) {
        query = query.eq("familia_id", selectedFamilia);
      } else {
        const childIds = familias.filter((f) => f.familia_pai_id === selectedFamilia).map((f) => f.id);
        query = childIds.length > 0 ? query.in("familia_id", childIds) : query.eq("familia_id", selectedFamilia);
      }
    }
    if (selectedFabricante !== "all") {
      query = query.eq("fabricante_id", selectedFabricante);
    }

    const { data } = await query;

    if (data) {
      const mapped: ProdutoComPreco[] = data.map((p: any) => {
        const imgs = p.produto_imagem || [];
        const sorted = [...imgs].sort((a: any, b: any) => a.ordem - b.ordem);
        return {
          produto_id: p.produto_id, nome: p.nome, slug: p.slug, descricao: p.descricao,
          familia_id: p.familia_id, fabricante_id: p.fabricante_id,
          familia_nome: p.familia?.nome ?? null, fabricante_nome: p.fabricante?.nome ?? null,
          preco: p.preco ?? 0, url_imagem: sorted[0]?.url_imagem ?? null,
          peso_bruto: p.peso_bruto, peso_liquido: p.peso_liquido,
          unidade_medida: p.unidade_medida || "un",
          aceita_fracionado: p.aceita_fracionado ?? false,
          quantidade_default: p.quantidade_default ?? 1,
        };
      });
      setProdutos(mapped);
    }
    setLoading(false);
  }, [selectedFamilia, selectedFabricante, familias]);

  useEffect(() => { loadProdutos(); }, [loadProdutos]);

  const filtered = useMemo(() => {
    if (!search.trim()) return produtos;
    const term = search.toLowerCase();
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.familia_nome?.toLowerCase().includes(term) ||
        p.fabricante_nome?.toLowerCase().includes(term)
    );
  }, [produtos, search]);

  const filteredFabricantes = useMemo(() => {
    if (selectedFamilia === "all" || loading) return fabricantes;
    const fabIdsInProducts = new Set(produtos.map((p) => p.fabricante_id).filter(Boolean));
    return fabricantes.filter((f) => fabIdsInProducts.has(f.id));
  }, [fabricantes, produtos, selectedFamilia, loading]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <CatalogHeader search={search} onSearchChange={setSearch} />

      {/* Filters - sticky below header */}
      <div className="sticky top-14 md:top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="px-4 py-3">
          <CatalogFilters
            familias={familias}
            fabricantes={filteredFabricantes}
            selectedFamilia={selectedFamilia}
            selectedFabricante={selectedFabricante}
            onFamiliaChange={(v) => { setSelectedFamilia(v); setSelectedFabricante("all"); }}
            onFabricanteChange={setSelectedFabricante}
          />
        </div>
      </div>

      <PullToRefresh onRefresh={loadProdutos}>
      <main className="flex-1 px-4 py-4 md:px-6 md:py-6 max-w-7xl mx-auto w-full">
        {/* Count */}
        <p className="text-xs text-muted-foreground mb-3">
          {loading ? "Carregando..." : `${filtered.length} produto(s)`}
        </p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <div className="h-24 w-24 rounded-2xl bg-muted/60 flex items-center justify-center">
              {search.trim() ? (
                <SearchIcon className="h-10 w-10 text-muted-foreground/30" />
              ) : (
                <Package className="h-10 w-10 text-muted-foreground/30" />
              )}
            </div>
            <p className="text-base font-semibold text-foreground">
              {search.trim() ? "Nenhum resultado" : "Nenhum produto encontrado"}
            </p>
            <p className="text-sm text-center max-w-xs">
              {search.trim()
                ? `Não encontramos produtos para "${search}". Tente outro termo.`
                : "Tente ajustar os filtros selecionados"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((p, i) => (
              <div
                key={p.produto_id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              >
                <ProductCard
                  produto_id={p.produto_id}
                  nome={p.nome}
                  preco={p.preco}
                  descricao={p.descricao ?? undefined}
                  url_imagem={p.url_imagem ?? undefined}
                  familia_nome={p.familia_nome ?? undefined}
                  fabricante_nome={p.fabricante_nome ?? undefined}
                  peso_bruto={p.peso_bruto ?? undefined}
                  peso_liquido={p.peso_liquido ?? undefined}
                  unidade_medida={p.unidade_medida}
                  aceita_fracionado={p.aceita_fracionado}
                  quantidade_default={p.quantidade_default}
                />
              </div>
            ))}
          </div>
        )}
      </main>
      </PullToRefresh>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <img
            src="/images/logo-cozinha-dodola.png"
            alt="CozinhaDoDola"
            className="h-10 w-auto opacity-60"
          />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">
              Política de Privacidade
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Entrar / Cadastrar
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            © {new Date().getFullYear()} CozinhaDoDola — Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
