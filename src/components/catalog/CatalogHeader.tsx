import { Link } from "react-router-dom";
import { ShoppingCart, User, Search, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import CartDrawer from "./CartDrawer";

interface CatalogHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
}

const CatalogHeader = ({ search, onSearchChange }: CatalogHeaderProps) => {
  const { user, signOut } = useAuth();
  const { count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleShare = async () => {
    const url = window.location.origin;
    const shareData = { title: "CozinhaDoDola - Catálogo", text: "Confira nosso catálogo de produtos!", url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-sidebar text-sidebar-foreground">
      {/* Main bar */}
      <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6">
        <Link to="/" className="flex items-center shrink-0">
          <img
            src="/images/logo-cozinha-dodola-branco.png"
            alt="CozinhaDoDola"
            className="h-12 md:h-14 w-auto"
          />
        </Link>

        {/* Desktop search */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/40" />
            <input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-full bg-sidebar-accent/60 border border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-ring transition-all"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {/* Mobile search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent rounded-full"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent rounded-full"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5" />
          </Button>

          {/* Cart */}
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent rounded-full">
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold">
                    {count}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md p-0" side="right">
              <SheetHeader className="px-4 pt-4 pb-2">
                <SheetTitle>Carrinho ({count})</SheetTitle>
              </SheetHeader>
              <CartDrawer onClose={() => setCartOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* User */}
          {user ? (
            <div className="flex items-center">
              <Link to="/perfil">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="hidden md:inline-flex text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-full text-xs"
              >
                Sair
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button
                size="sm"
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-4"
              >
                Entrar
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile search bar - slides down */}
      {searchOpen && (
        <div className="md:hidden px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/40" />
            <input
              ref={searchRef}
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-10 rounded-full bg-sidebar-accent/60 border border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default CatalogHeader;
