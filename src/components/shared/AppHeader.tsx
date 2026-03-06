import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface AppHeaderProps {
  backTo?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

const AppHeader = ({ backTo, backLabel, children }: AppHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center shrink-0">
            <img
              src="/images/logo-cozinha-dodola-branco.png"
              alt="CozinhaDoDola"
              className="h-12 md:h-14 w-auto"
            />
          </Link>

          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="flex items-center gap-1 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm hidden sm:inline">{backLabel || "Voltar"}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {children}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
