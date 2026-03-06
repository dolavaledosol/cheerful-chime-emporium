import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") {
      setIsRecovery(true);
    }
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha atualizada!", description: "Sua senha foi redefinida com sucesso." });
      navigate("/");
    }
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <div className="flex items-center justify-center bg-sidebar py-6">
          <img src="/images/logo-cozinha-dodola-branco.png" alt="Cozinha Do Dola" className="h-14 w-auto" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Link inválido</h1>
              <p className="text-sm text-muted-foreground">Este link de recuperação é inválido ou expirou.</p>
            </div>
            <button
              onClick={() => navigate("/auth")}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    "flex h-12 w-full rounded-xl border border-input bg-card pl-10 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="flex items-center justify-center bg-sidebar py-6">
        <img src="/images/logo-cozinha-dodola-branco.png" alt="Cozinha Do Dola" className="h-14 w-auto" />
      </div>

      <div className="flex flex-1 flex-col items-center px-4 pt-6 pb-8 md:justify-center md:pt-0">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Redefinir senha</h1>
            <p className="text-sm text-muted-foreground">Digite sua nova senha abaixo</p>
          </div>

          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className="text-sm font-medium text-foreground">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="flex h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Aguarde..." : "Redefinir senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
