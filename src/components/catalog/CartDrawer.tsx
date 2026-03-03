import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

interface CartDrawerProps {
  onClose: () => void;
}

const CartDrawer = ({ onClose }: CartDrawerProps) => {
  const { items, total, count, updateQuantity, removeItem, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-muted-foreground">
        <ShoppingBag className="h-16 w-16 stroke-1" />
        <p className="text-lg">Seu carrinho está vazio</p>
        <Button variant="outline" onClick={onClose}>
          Continuar comprando
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {items.map((item) => (
          <div key={item.produto_id} className="flex gap-3 items-start border-b pb-4">
            {item.url_imagem ? (
              <img
                src={item.url_imagem}
                alt={item.nome}
                className="h-16 w-16 rounded-md object-cover bg-muted shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                <ShoppingBag className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.nome}</p>
              <p className="text-sm text-primary font-semibold">
                R$ {item.preco.toFixed(2)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.produto_id, item.quantidade - (item.aceita_fracionado ? 0.1 : 1))}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                {item.aceita_fracionado ? (
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={item.quantidade}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) updateQuantity(item.produto_id, Math.round(v * 10) / 10);
                    }}
                    className="w-14 h-7 text-center text-sm border rounded-md bg-background"
                  />
                ) : (
                  <span className="text-sm w-6 text-center">{item.quantidade}</span>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.produto_id, item.quantidade + (item.aceita_fracionado ? 0.1 : 1))}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-auto text-destructive"
                  onClick={() => removeItem(item.produto_id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
        <Button className="w-full" size="lg" asChild>
          <Link to="/checkout" onClick={onClose}>
            Finalizar pedido
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={clearCart}>
          Limpar carrinho
        </Button>
      </div>
    </div>
  );
};

export default CartDrawer;
