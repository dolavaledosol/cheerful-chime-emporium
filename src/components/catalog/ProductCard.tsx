import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShoppingCart, Package, Weight, Share2 } from "lucide-react";
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
  aceita_fracionado = false,
  quantidade_default = 1,
}: ProductCardProps) => {
  const { addItem } = useCart();
  const { toast } = useToast();
  const [detailOpen, setDetailOpen] = useState(false);
  const [quantidade, setQuantidade] = useState(String(quantidade_default));

  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const qty = parseFloat(quantidade);
    if (isNaN(qty) || qty <= 0) return;
    addItem({ produto_id, nome, preco, url_imagem, aceita_fracionado }, qty);
    toast({ title: "Adicionado ao carrinho", description: `${qty} × ${nome}` });
  };

  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `${window.location.origin}/?produto=${produto_id}`;
    const shareData = { title: nome, text: `Confira: ${nome} - R$ ${preco.toFixed(2)}`, url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: nome });
    }
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
          {(pesoStr || aceita_fracionado) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              {pesoStr && <><Weight className="h-3 w-3" /> {pesoStr}</>}
              {aceita_fracionado && (
                <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
                  Fracionado
                </span>
              )}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-primary">
                R$ {(preco * parseFloat(quantidade || "1")).toFixed(2)}
              </span>
              {parseFloat(quantidade) !== 1 && (
                <span className="text-[10px] text-muted-foreground">
                  R$ {preco.toFixed(2)} / {unidadeLabels[unidade_medida] || unidade_medida}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step={aceita_fracionado ? "0.1" : "1"}
                min={aceita_fracionado ? "0.1" : "1"}
                value={quantidade}
                onChange={(e) => { e.stopPropagation(); setQuantidade(e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                className="w-14 h-8 text-center text-sm border rounded-md bg-background"
              />
              <Button size="sm" onClick={handleAdd} className="gap-1.5 shrink-0">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>{nome}</DialogTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleShare} className="shrink-0 h-8 w-8">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Compartilhar produto</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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

            {(pesoStr || aceita_fracionado) && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                {pesoStr && <><Weight className="h-4 w-4" /> Peso: {pesoStr}</>}
                {aceita_fracionado && (
                  <span className="text-xs uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">
                    Fracionado
                  </span>
                )}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-primary">
                  R$ {(preco * parseFloat(quantidade || "1")).toFixed(2)}
                </span>
                {parseFloat(quantidade) !== 1 && (
                  <span className="text-xs text-muted-foreground">
                    R$ {preco.toFixed(2)} / {unidadeLabels[unidade_medida] || unidade_medida}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={aceita_fracionado ? "0.1" : "1"}
                  min={aceita_fracionado ? "0.1" : "1"}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="w-16 h-9 text-center text-sm border rounded-md bg-background"
                />
                <Button onClick={() => { handleAdd(); setDetailOpen(false); }} className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductCard;
