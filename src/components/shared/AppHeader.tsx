import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  /** Where "back" goes — e.g. "/" for catalog, "/admin" for admin */
  backTo?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

const AppHeader = ({ backTo, backLabel, children }: AppHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-sidebar text-sidebar-foreground">
      <div className="px-4 h-20 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/images/logo-cozinha-dodola-branco.png"
            alt="CozinhaDoDola"
            className="h-20 w-auto"
          />
        </Link>

        {backTo && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => navigate(backTo)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{backLabel || "Voltar"}</span>
          </Button>
        )}

        <div className="flex-1" />
        {children}
      </div>
    </header>
  );
};

export default AppHeader;
