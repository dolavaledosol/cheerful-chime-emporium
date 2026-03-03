import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CartItem {
  produto_id: string;
  nome: string;
  preco: number;
  quantidade: number;
  url_imagem?: string;
  aceita_fracionado?: boolean;
}

interface CartContextType {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: Omit<CartItem, "quantidade">, quantidade?: number) => void;
  removeItem: (produto_id: string) => void;
  updateQuantity: (produto_id: string, quantidade: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>({
  items: [],
  count: 0,
  total: 0,
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
});

const CART_STORAGE_KEY = "cozinha_do_dola_cart";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "quantidade">, quantidade: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.produto_id === item.produto_id);
      if (existing) {
        return prev.map((i) =>
          i.produto_id === item.produto_id
            ? { ...i, quantidade: i.quantidade + quantidade }
            : i
        );
      }
      return [...prev, { ...item, quantidade }];
    });
  }, []);

  const removeItem = useCallback((produto_id: string) => {
    setItems((prev) => prev.filter((i) => i.produto_id !== produto_id));
  }, []);

  const updateQuantity = useCallback((produto_id: string, quantidade: number) => {
    const rounded = Math.round(quantidade * 10) / 10;
    if (rounded <= 0) {
      setItems((prev) => prev.filter((i) => i.produto_id !== produto_id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.produto_id === produto_id ? { ...i, quantidade: rounded } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = items.reduce((acc, i) => acc + i.quantidade, 0);
  const total = items.reduce((acc, i) => acc + i.preco * i.quantidade, 0);

  return (
    <CartContext.Provider value={{ items, count, total, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
