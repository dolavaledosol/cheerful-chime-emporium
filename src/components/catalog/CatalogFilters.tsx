import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface FilterOption {
  id: string;
  nome: string;
}

interface FamiliaOption extends FilterOption {
  familia_pai_id: string | null;
}

interface CatalogFiltersProps {
  familias: FamiliaOption[];
  fabricantes: FilterOption[];
  selectedFamilia: string;
  selectedFabricante: string;
  onFamiliaChange: (value: string) => void;
  onFabricanteChange: (value: string) => void;
}

const CatalogFilters = ({
  familias,
  fabricantes,
  selectedFamilia,
  selectedFabricante,
  onFamiliaChange,
  onFabricanteChange,
}: CatalogFiltersProps) => {
  const hasFilters = selectedFamilia !== "all" || selectedFabricante !== "all";

  // Top-level families (no parent)
  const parentFamilias = useMemo(
    () => familias.filter((f) => !f.familia_pai_id),
    [familias]
  );

  // Subfamilies of the currently selected parent
  const subFamilias = useMemo(() => {
    if (selectedFamilia === "all") return [];
    // Check if selected is a parent
    const children = familias.filter((f) => f.familia_pai_id === selectedFamilia);
    if (children.length > 0) return children;
    // Check if selected is itself a child — show siblings
    const selected = familias.find((f) => f.id === selectedFamilia);
    if (selected?.familia_pai_id) {
      return familias.filter((f) => f.familia_pai_id === selected.familia_pai_id);
    }
    return [];
  }, [familias, selectedFamilia]);

  // Determine if the selected familia is a parent (to highlight it but also show subs)
  const selectedIsParent = useMemo(
    () => parentFamilias.some((p) => p.id === selectedFamilia),
    [parentFamilias, selectedFamilia]
  );

  return (
    <div className="space-y-3">
      {/* Família filter - parents */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Família</p>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            <Button
              variant={selectedFamilia === "all" ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => onFamiliaChange("all")}
            >
              Todas
            </Button>
            {parentFamilias.map((f) => {
              const isActive = selectedFamilia === f.id || 
                (!selectedIsParent && familias.find((x) => x.id === selectedFamilia)?.familia_pai_id === f.id);
              return (
                <Button
                  key={f.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => onFamiliaChange(isActive && selectedFamilia === f.id ? "all" : f.id)}
                >
                  {f.nome}
                </Button>
              );
            })}
            {/* Show families without parent that aren't parents themselves (leaf without hierarchy) */}
            {familias
              .filter((f) => !f.familia_pai_id && !familias.some((c) => c.familia_pai_id === f.id))
              .length === 0
              ? null
              : null}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Subfamília filter - only when a parent with children is selected */}
      {subFamilias.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Subfamília</p>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {selectedIsParent && (
                <Button
                  variant="default"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => {}}
                >
                  Todas
                </Button>
              )}
              {subFamilias.map((f) => (
                <Button
                  key={f.id}
                  variant={selectedFamilia === f.id ? "default" : "outline"}
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => onFamiliaChange(selectedFamilia === f.id ? f.familia_pai_id || "all" : f.id)}
                >
                  {f.nome}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Fabricante filter */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Fabricante</p>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            <Button
              variant={selectedFabricante === "all" ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => onFabricanteChange("all")}
            >
              Todos
            </Button>
            {fabricantes.map((f) => (
              <Button
                key={f.id}
                variant={selectedFabricante === f.id ? "default" : "outline"}
                size="sm"
                className="shrink-0 rounded-full"
                onClick={() => onFabricanteChange(selectedFabricante === f.id ? "all" : f.id)}
              >
                {f.nome}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => {
            onFamiliaChange("all");
            onFabricanteChange("all");
          }}
        >
          <X className="h-3 w-3" /> Limpar filtros
        </Button>
      )}
    </div>
  );
};

export default CatalogFilters;
