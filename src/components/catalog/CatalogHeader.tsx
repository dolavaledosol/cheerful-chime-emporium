import { Link } from "react-router-dom";
import { ShoppingCart, User, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-sidebar text-sidebar-foreground">
      <div className="container mx-auto px-4">
        {/* Top bar */}
        <div className="flex h-14 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/images/logo-cozinha-dodola-branco.png"
              alt="CozinhaDoDola"
              className="h-14 w-auto"
            />
          </Link>

          {/* Desktop search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
              <Input
                placeholder="Buscar produtos..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Cart */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-sidebar-foreground hover:bg-sidebar-accent">
                  <ShoppingCart className="h-5 w-5" />
                  {count > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {count}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader><SheetTitle>Carrinho</SheetTitle></SheetHeader>
                <CartDrawer onClose={() => setCartOpen(false)} />
              </SheetContent>
            </Sheet>

            {/* User menu desktop */}
            {user ? (
              <div className="hidden md:flex items-center gap-1">
                <Link to="/perfil">
                  <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent">
                  Sair
                </Button>
              </div>
            ) : (
              <Link to="/auth" className="hidden md:block">
                <Button size="sm" variant="secondary" className="bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80">
                  Entrar
                </Button>
              </Link>
            )}

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <div className="flex flex-col gap-3 mt-6">
                  {user ? (
                    <>
                      <Link to="/perfil" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start gap-2">
                          <User className="h-4 w-4" /> Meu Perfil
                        </Button>
                      </Link>
                      <Button variant="ghost" className="w-full justify-start" onClick={() => { signOut(); setMobileMenuOpen(false); }}>
                        Sair
                      </Button>
                    </>
                  ) : (
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full">Entrar / Cadastrar</Button>
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default CatalogHeader;
