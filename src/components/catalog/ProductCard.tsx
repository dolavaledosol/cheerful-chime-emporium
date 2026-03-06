import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShoppingCart, Package, Weight, Share2, Minus, Plus } from "lucide-react";
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
  aceita_fracionado?: boolean;
  quantidade_default?: number;
}

const unidadeLabels: Record<string, string> = {
  un: "un", kg: "kg", g: "g", l: "L", ml: "ml",
  cx: "cx", pct: "pct", par: "par", m: "m", cm: "cm",
};

const formatPeso = (peso: number | undefined, unidade: string) => {
  if (!peso) return null;
  return `${peso}${unidadeLabels[unidade] || unidade}`;
};

const ProductCard = memo(function ProductCard({
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
  aceita_fracionado = false,
  quantidade_default = 1,
}: ProductCardProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const [detailOpen, setDetailOpen] = useState(false);
  const [quantidade, setQuantidade] = useState(quantidade_default);

  const step = aceita_fracionado ? 0.1 : 1;
  const minQty = aceita_fracionado ? 0.1 : 1;

  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (quantidade <= 0) return;
    addItem({ produto_id, nome, preco, url_imagem, aceita_fracionado }, quantidade);
    toast({ title: "Adicionado ao carrinho", description: `${quantidade} × ${nome}` });
  };

  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/?produto=${produto_id}`;
    const text = `🍳 *${nome}*\n💰 R$ ${preco.toFixed(2)}\n\nVeja no catálogo: ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: nome, text: `${nome} - R$ ${preco.toFixed(2)}`, url });
      } catch {
        window.open(whatsappUrl, "_blank");
      }
    } else {
      window.open(whatsappUrl, "_blank");
    }
  };

  const increment = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setQuantidade((q) => Math.round((q + step) * 10) / 10);
  };
  const decrement = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setQuantidade((q) => Math.max(minQty, Math.round((q - step) * 10) / 10));
  };

  const pesoStr = formatPeso(peso_liquido, unidade_medida) || formatPeso(peso_bruto, unidade_medida);

  return (
    <>
      {/* Card */}
      <div
        className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group active:scale-[0.98] border border-border/50"
        onClick={() => setDetailOpen(true)}
      >
        {/* Image */}
        <div className="aspect-square relative bg-muted overflow-hidden">
          {url_imagem ? (
            <img
              src={url_imagem}
              alt={nome}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {/* Quick add floating button */}
          <button
            onClick={handleAdd}
            className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>

        {/* Info */}
        <div className="p-3 space-y-1.5">
          {familia_nome && (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              {familia_nome}
            </span>
          )}
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5em] text-card-foreground">
            {nome}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {pesoStr && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Weight className="h-3 w-3" /> {pesoStr}
              </span>
            )}
            {aceita_fracionado && (
              <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-semibold">
                Fracionado
              </span>
            )}
          </div>
          <div className="pt-1">
            <span className="text-lg font-bold text-primary">
              R$ {preco.toFixed(2)}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1">
              / {unidadeLabels[unidade_medida] || unidade_medida}
            </span>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md mx-4 p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
          <div className="overflow-y-auto flex-1">
            {/* Image */}
            {url_imagem && (
              <div className="aspect-square bg-muted overflow-hidden">
                <img src={url_imagem} alt={nome} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="p-5 space-y-4">
              <DialogHeader className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    {familia_nome && (
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                        {familia_nome}
                      </span>
                    )}
                    <DialogTitle className="text-xl leading-tight">{nome}</DialogTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleShare} className="shrink-0 h-9 w-9 rounded-full">
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Compartilhar produto</TooltipContent>
                  </Tooltip>
                </div>
              </DialogHeader>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {fabricante_nome && (
                  <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    {fabricante_nome}
                  </span>
                )}
                {pesoStr && (
                  <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Weight className="h-3 w-3" /> {pesoStr}
                  </span>
                )}
                {aceita_fracionado && (
                  <span className="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full font-medium">
                    Fracionado
                  </span>
                )}
              </div>

              {descricao && (
                <p className="text-sm text-muted-foreground leading-relaxed">{descricao}</p>
              )}
            </div>
          </div>

          {/* Sticky bottom bar */}
          <div className="border-t bg-card p-4 space-y-3 safe-bottom">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-primary">
                  R$ {(preco * quantidade).toFixed(2)}
                </span>
                {quantidade !== 1 && (
                  <p className="text-xs text-muted-foreground">
                    R$ {preco.toFixed(2)} / {unidadeLabels[unidade_medida] || unidade_medida}
                  </p>
                )}
              </div>

              {/* Quantity stepper */}
              <div className="flex items-center gap-0 bg-muted rounded-full">
                <button
                  onClick={decrement}
                  className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted-foreground/10 transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  step={step}
                  min={minQty}
                  value={quantidade}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setQuantidade(Math.round(v * 10) / 10);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-12 h-10 text-center text-sm font-semibold bg-transparent border-0 focus:outline-none"
                />
                <button
                  onClick={increment}
                  className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted-foreground/10 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <Button
              onClick={() => { handleAdd(); setDetailOpen(false); }}
              className="w-full h-12 rounded-full text-base font-semibold gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              Adicionar ao carrinho
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
