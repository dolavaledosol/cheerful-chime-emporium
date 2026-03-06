import { useMemo } from "react";
import { X } from "lucide-react";

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

const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-card text-foreground/70 border border-border hover:border-primary/30 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const CatalogFilters = ({
  familias,
  fabricantes,
  selectedFamilia,
  selectedFabricante,
  onFamiliaChange,
  onFabricanteChange,
}: CatalogFiltersProps) => {
  const hasFilters = selectedFamilia !== "all" || selectedFabricante !== "all";

  const parentFamilias = useMemo(
    () => familias.filter((f) => !f.familia_pai_id),
    [familias]
  );

  const subFamilias = useMemo(() => {
    if (selectedFamilia === "all") return [];
    const children = familias.filter((f) => f.familia_pai_id === selectedFamilia);
    if (children.length > 0) return children;
    const selected = familias.find((f) => f.id === selectedFamilia);
    if (selected?.familia_pai_id) {
      return familias.filter((f) => f.familia_pai_id === selected.familia_pai_id);
    }
    return [];
  }, [familias, selectedFamilia]);

  const selectedIsParent = useMemo(
    () => parentFamilias.some((p) => p.id === selectedFamilia),
    [parentFamilias, selectedFamilia]
  );

  return (
    <div className="space-y-2">
      {/* Main categories */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        <Chip active={selectedFamilia === "all"} onClick={() => onFamiliaChange("all")}>
          Tudo
        </Chip>
        {parentFamilias.map((f) => {
          const isActive =
            selectedFamilia === f.id ||
            (!selectedIsParent &&
              familias.find((x) => x.id === selectedFamilia)?.familia_pai_id === f.id);
          return (
            <Chip
              key={f.id}
              active={!!isActive}
              onClick={() => onFamiliaChange(isActive && selectedFamilia === f.id ? "all" : f.id)}
            >
              {f.nome}
            </Chip>
          );
        })}
      </div>

      {/* Subcategories */}
      {subFamilias.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {selectedIsParent && (
            <Chip active onClick={() => {}}>
              Todas
            </Chip>
          )}
          {subFamilias.map((f) => (
            <Chip
              key={f.id}
              active={selectedFamilia === f.id}
              onClick={() =>
                onFamiliaChange(selectedFamilia === f.id ? f.familia_pai_id || "all" : f.id)
              }
            >
              {f.nome}
            </Chip>
          ))}
        </div>
      )}

      {/* Brands */}
      {fabricantes.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          <Chip
            active={selectedFabricante === "all"}
            onClick={() => onFabricanteChange("all")}
          >
            Marcas
          </Chip>
          {fabricantes.map((f) => (
            <Chip
              key={f.id}
              active={selectedFabricante === f.id}
              onClick={() => onFabricanteChange(selectedFabricante === f.id ? "all" : f.id)}
            >
              {f.nome}
            </Chip>
          ))}
        </div>
      )}

      {/* Clear */}
      {hasFilters && (
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {
            onFamiliaChange("all");
            onFabricanteChange("all");
          }}
        >
          <X className="h-3 w-3" /> Limpar filtros
        </button>
      )}
    </div>
  );
};

export default CatalogFilters;
