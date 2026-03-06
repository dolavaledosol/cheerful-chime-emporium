import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type AuthMode = "login" | "register" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      navigate(redirectTo);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: nome },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro." });
      setMode("login");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setMode("login");
    }
  };

  const title = mode === "login" ? "Bem-vindo de volta" : mode === "register" ? "Criar conta" : "Recuperar senha";
  const subtitle = mode === "login"
    ? "Entre para continuar comprando"
    : mode === "register"
      ? "Preencha seus dados para começar"
      : "Informe seu e-mail para redefinir";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Brand header */}
      <div className="flex items-center justify-center bg-sidebar py-6">
        <img
          src="/images/logo-cozinha-dodola-branco.png"
          alt="Cozinha Do Dola"
          className="h-14 w-auto"
        />
      </div>

      {/* Form area */}
      <div className="flex flex-1 flex-col items-center px-4 pt-6 pb-8 md:justify-center md:pt-0">
        <div className="w-full max-w-sm space-y-6">
          {/* Title */}
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {/* Form */}
          <form
            onSubmit={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgotPassword}
            className="space-y-4"
          >
            {mode === "register" && (
              <div className="space-y-1.5">
                <label htmlFor="nome" className="text-sm font-medium text-foreground">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="nome"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="flex h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Senha
                </label>
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
                    className="flex h-12 w-full rounded-xl border border-input bg-card pl-10 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
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
            )}

            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground text-base font-semibold shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : mode === "register"
                    ? "Cadastrar"
                    : "Enviar e-mail"}
            </button>
          </form>

          {/* Footer links */}
          <div className="text-center">
            {mode === "login" && (
              <p className="text-sm text-muted-foreground">
                Não tem conta?{" "}
                <button onClick={() => setMode("register")} className="font-semibold text-primary hover:underline">
                  Cadastre-se
                </button>
              </p>
            )}
            {mode === "register" && (
              <p className="text-sm text-muted-foreground">
                Já tem conta?{" "}
                <button onClick={() => setMode("login")} className="font-semibold text-primary hover:underline">
                  Entrar
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button
                onClick={() => setMode("login")}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
