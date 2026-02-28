import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import CatalogHeader from "@/components/catalog/CatalogHeader";
import CatalogFilters from "@/components/catalog/CatalogFilters";
import ProductCard from "@/components/catalog/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

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
}

const Index = () => {
  const [search, setSearch] = useState("");
  const [selectedFamilia, setSelectedFamilia] = useState("all");
  const [selectedFabricante, setSelectedFabricante] = useState("all");
  const [produtos, setProdutos] = useState<ProdutoComPreco[]>([]);
  const [familias, setFamilias] = useState<{ id: string; nome: string; familia_pai_id: string | null }[]>([]);
  const [fabricantes, setFabricantes] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Load filters
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

  // Load products - use produto.preco as the catalog price
  useEffect(() => {
    const loadProdutos = async () => {
      setLoading(true);

      let query = supabase
        .from("produto")
        .select(`
          produto_id,
          nome,
          slug,
          descricao,
          preco,
          peso_bruto,
          peso_liquido,
          unidade_medida,
          familia_id,
          fabricante_id,
          familia:familia_id (nome),
          fabricante:fabricante_id (nome),
          produto_imagem (url_imagem, ordem)
        `)
        .eq("ativo", true)
        .order("nome");

      if (selectedFamilia !== "all") {
        const selectedFam = familias.find((f) => f.id === selectedFamilia);
        const isChild = selectedFam?.familia_pai_id != null;

        if (isChild) {
          // Subfamily selected — show only products of this subfamily
          query = query.eq("familia_id", selectedFamilia);
        } else {
          // Parent selected — show products from all children only (parent has no products itself)
          const childIds = familias
            .filter((f) => f.familia_pai_id === selectedFamilia)
            .map((f) => f.id);
          if (childIds.length > 0) {
            query = query.in("familia_id", childIds);
          } else {
            query = query.eq("familia_id", selectedFamilia);
          }
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
            produto_id: p.produto_id,
            nome: p.nome,
            slug: p.slug,
            descricao: p.descricao,
            familia_id: p.familia_id,
            fabricante_id: p.fabricante_id,
            familia_nome: p.familia?.nome ?? null,
            fabricante_nome: p.fabricante?.nome ?? null,
            preco: p.preco ?? 0,
            url_imagem: sorted[0]?.url_imagem ?? null,
            peso_bruto: p.peso_bruto,
            peso_liquido: p.peso_liquido,
            unidade_medida: p.unidade_medida || "un",
          };
        });
        setProdutos(mapped);
      }
      setLoading(false);
    };
    loadProdutos();
  }, [selectedFamilia, selectedFabricante]);

  // Client-side search filter
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

  // Fabricantes filtered to only those present in current products (filtered by family)
  const filteredFabricantes = useMemo(() => {
    if (selectedFamilia === "all" || loading) return fabricantes;
    const fabIdsInProducts = new Set(produtos.map((p) => p.fabricante_id).filter(Boolean));
    return fabricantes.filter((f) => fabIdsInProducts.has(f.id));
  }, [fabricantes, produtos, selectedFamilia, loading]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CatalogHeader search={search} onSearchChange={setSearch} />

      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="mb-6">
          <CatalogFilters
            familias={familias}
            fabricantes={filteredFabricantes}
            selectedFamilia={selectedFamilia}
            selectedFabricante={selectedFabricante}
            onFamiliaChange={(v) => { setSelectedFamilia(v); setSelectedFabricante("all"); }}
            onFabricanteChange={setSelectedFabricante}
          />
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {loading ? "Carregando..." : `${filtered.length} produto(s) encontrado(s)`}
        </p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <Package className="h-16 w-16 stroke-1" />
            <p className="text-lg">Nenhum produto encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou a busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.produto_id}
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
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CozinhaDoDola — Todos os direitos reservados
      </footer>
    </div>
  );
};

export default Index;
