import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

interface CartDrawerProps {
  onClose: () => void;
}

const CartDrawer = ({ onClose }: CartDrawerProps) => {
  const { items, total, count, updateQuantity, removeItem, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-muted-foreground px-4">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="text-lg font-medium">Carrinho vazio</p>
        <p className="text-sm text-center">Adicione produtos do catálogo para começar</p>
        <Button variant="outline" onClick={onClose} className="rounded-full mt-2">
          Continuar comprando
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {items.map((item) => (
          <div key={item.produto_id} className="flex gap-3 items-start bg-muted/50 rounded-xl p-3">
            {item.url_imagem ? (
              <img
                src={item.url_imagem}
                alt={item.nome}
                className="h-16 w-16 rounded-lg object-cover bg-muted shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2 leading-snug">{item.nome}</p>
              <p className="text-sm text-primary font-bold mt-0.5">
                R$ {(item.preco * item.quantidade).toFixed(2)}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <div className="flex items-center bg-card rounded-full border border-border">
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                    onClick={() =>
                      updateQuantity(
                        item.produto_id,
                        item.quantidade - (item.aceita_fracionado ? 0.1 : 1)
                      )
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  {item.aceita_fracionado ? (
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={item.quantidade}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0)
                          updateQuantity(item.produto_id, Math.round(v * 10) / 10);
                      }}
                      className="w-10 h-8 text-center text-sm bg-transparent border-0 focus:outline-none font-medium"
                    />
                  ) : (
                    <span className="text-sm w-8 text-center font-medium">{item.quantidade}</span>
                  )}
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                    onClick={() =>
                      updateQuantity(
                        item.produto_id,
                        item.quantidade + (item.aceita_fracionado ? 0.1 : 1)
                      )
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  className="h-8 w-8 flex items-center justify-center ml-auto text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                  onClick={() => removeItem(item.produto_id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 pt-4 pb-4 space-y-3 safe-bottom">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{count} item(ns)</span>
          <span className="text-xl font-bold">R$ {total.toFixed(2)}</span>
        </div>
        <Button className="w-full h-12 rounded-full text-base font-semibold" asChild>
          <Link to="/checkout" onClick={onClose}>
            Finalizar pedido
          </Link>
        </Button>
        <button
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          onClick={clearCart}
        >
          Limpar carrinho
        </button>
      </div>
    </div>
  );
};

export default CartDrawer;
