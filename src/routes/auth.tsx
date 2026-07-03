import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, ShieldCheck, Sparkles, BarChart3, Eye, EyeOff, AlertCircle } from "lucide-react";
import { friendlyAuthError, type AuthErrorField } from "@/lib/auth-errors";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar - Controle de Ponto" },
      { name: "description", content: "Acesse sua conta ou crie uma nova para começar a bater ponto." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, configured, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<AuthErrorField | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);


  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden="true" />
          <span className="text-sm">Carregando…</span>
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldError(null);
    if (tab === "signup" && password !== confirmPassword) {
      setFormError("As senhas não coincidem.");
      setFieldError("password");
      confirmRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      if (tab === "login") {
        await signIn(email, password);
      } else {
        await signUp(name, email, password);
      }
      navigate({ to: "/app" });
    } catch (err) {
      const { message, field } = friendlyAuthError(err);
      setFormError(message);
      setFieldError(field);
      const target =
        field === "email"
          ? emailRef.current
          : field === "password"
            ? passwordRef.current
            : field === "name"
              ? nameRef.current
              : emailRef.current;
      target?.focus();
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Left panel — hero */}
      <aside className="relative hidden lg:flex bg-gradient-hero text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Clock className="h-6 w-6" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Controle de Ponto</span>
        </div>
        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Sua jornada de trabalho, sob controle.
          </h2>
          <p className="text-white text-lg">
            Registre entradas, pausas e saídas em segundos. Acompanhe seu saldo de horas
            em tempo real.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0 mt-0.5" />
              <span>Sugestão automática do próximo tipo de ponto do dia.</span>
            </li>
            <li className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 shrink-0 mt-0.5" />
              <span>Histórico completo com exportação em CSV.</span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
              <span>Seus dados protegidos e sincronizados na nuvem.</span>
            </li>
          </ul>
        </div>
        <div className="relative z-10 text-xs text-white">
          © {new Date().getFullYear()} Controle de Ponto
        </div>
      </aside>

      {/* Right panel — form */}
      <section className="flex flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow-primary text-white">
              <Clock className="h-5 w-5 text-white" />
            </span>
            <h1 className="text-xl font-semibold text-foreground">Controle de Ponto</h1>
          </div>

          {!configured && (
            <Card
              className="mb-4 shadow-elegant"
              style={{ borderColor: "var(--warning)" }}
            >
              <CardHeader>
                <CardTitle className="text-base">Firebase não configurado</CardTitle>
                <CardDescription>
                  Defina as variáveis <code className="font-mono text-xs">VITE_FIREBASE_*</code>. Veja o
                  arquivo <code className="font-mono text-xs">FIREBASE_SETUP.md</code> na raiz do projeto.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card className="shadow-elevated border-border/70">
            <CardHeader className="space-y-1.5">
              <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
              <CardDescription>
                {tab === "login"
                  ? "Entre com sua conta para continuar."
                  : "Crie sua conta em poucos segundos."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  setTab(v as "login" | "signup");
                  setFormError(null);
                  setFieldError(null);
                }}
              >
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>
                <TabsContent value="login" />
                <TabsContent value="signup" />
              </Tabs>

              <form onSubmit={onSubmit} className="space-y-4 mt-5" noValidate>
                {formError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p className="leading-snug">{formError}</p>
                  </div>
                )}
                {tab === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      ref={nameRef}
                      autoComplete="name"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={fieldError === "name"}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={fieldError === "email"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      ref={passwordRef}
                      type={showPassword ? "text" : "password"}
                      autoComplete={tab === "login" ? "current-password" : "new-password"}
                      placeholder="Mínimo de 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      aria-invalid={fieldError === "password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      aria-controls="password"
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                {tab === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar senha</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        ref={confirmRef}
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        aria-invalid={
                          confirmPassword.length > 0 && confirmPassword !== password
                        }
                        aria-describedby="confirm-password-help"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"
                        }
                        aria-pressed={showConfirmPassword}
                        aria-controls="confirm-password"
                        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p
                      id="confirm-password-help"
                      className={
                        confirmPassword.length > 0 && confirmPassword !== password
                          ? "text-xs font-medium text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                      aria-live="polite"
                    >
                      {confirmPassword.length > 0 && confirmPassword !== password
                        ? "As senhas não coincidem."
                        : "Digite a mesma senha para confirmar."}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold text-white bg-gradient-primary shadow-glow-primary hover:opacity-95"
                  disabled={busy || !configured}
                >
                  {busy ? "Aguarde…" : tab === "login" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Ao continuar, você concorda com os termos de uso do aplicativo.
          </p>
        </div>
      </section>
    </div>
  );
}
