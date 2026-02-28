import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Package, Weight } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  produto_id: string;
  nome: string;
  preco: number;
  descricao?: string;
  url_imagem?: string;
  familia_nome?: string;
  fabricante_nome?: string;
  peso_bruto?: number;
  peso_liquido?: number;
  unidade_medida?: string;
}

const unidadeLabels: Record<string, string> = {
  un: "un", kg: "kg", g: "g", l: "L", ml: "ml",
  cx: "cx", pct: "pct", par: "par", m: "m", cm: "cm",
};

const formatPeso = (peso: number | undefined, unidade: string) => {
  if (!peso) return null;
  return `${peso}${unidadeLabels[unidade] || unidade}`;
};

const ProductCard = ({
  produto_id,
  nome,
  preco,
  descricao,
  url_imagem,
  familia_nome,
  fabricante_nome,
  peso_bruto,
  peso_liquido,
  unidade_medida = "un",
}: ProductCardProps) => {
  const { addItem } = useCart();
  const { toast } = useToast();
  const [detailOpen, setDetailOpen] = useState(false);

  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    addItem({ produto_id, nome, preco, url_imagem });
    toast({ title: "Adicionado ao carrinho", description: nome });
  };

  const pesoStr = formatPeso(peso_liquido, unidade_medida) || formatPeso(peso_bruto, unidade_medida);

  return (
    <>
      <Card
        className="group overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
        onClick={() => setDetailOpen(true)}
      >
        <div className="aspect-square relative bg-muted overflow-hidden">
          {url_imagem ? (
            <img
              src={url_imagem}
              alt={nome}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <CardContent className="p-3 space-y-2">
          {(familia_nome || fabricante_nome) && (
            <div className="flex flex-wrap gap-1">
              {familia_nome && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {familia_nome}
                </span>
              )}
              {fabricante_nome && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {fabricante_nome}
                </span>
              )}
            </div>
          )}
          <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
            {nome}
          </h3>
          {pesoStr && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Weight className="h-3 w-3" /> {pesoStr}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-bold text-primary">
              R$ {preco.toFixed(2)}
            </span>
            <Button size="sm" onClick={handleAdd} className="gap-1.5 shrink-0">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Product detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {url_imagem && (
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={url_imagem} alt={nome} className="h-full w-full object-cover" />
              </div>
            )}

            {(familia_nome || fabricante_nome) && (
              <div className="flex flex-wrap gap-1">
                {familia_nome && (
                  <span className="text-xs uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded">
                    {familia_nome}
                  </span>
                )}
                {fabricante_nome && (
                  <span className="text-xs uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded">
                    {fabricante_nome}
                  </span>
                )}
              </div>
            )}

            {descricao && (
              <p className="text-sm text-muted-foreground leading-relaxed">{descricao}</p>
            )}

            {pesoStr && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Weight className="h-4 w-4" /> Peso: {pesoStr}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-2xl font-bold text-primary">
                R$ {preco.toFixed(2)}
              </span>
              <Button onClick={() => { handleAdd(); setDetailOpen(false); }} className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductCard;
