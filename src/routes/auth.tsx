import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, ShieldCheck, Sparkles, BarChart3 } from "lucide-react";

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
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      if (tab === "login") {
        await signIn(email, password);
      } else {
        await signUp(name, email, password);
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Left panel — hero */}
      <aside className="relative hidden lg:flex bg-gradient-hero text-primary-foreground p-12 flex-col justify-between overflow-hidden">
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
          <p className="text-primary-foreground/85 text-lg">
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
        <div className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Controle de Ponto
        </div>
      </aside>

      {/* Right panel — form */}
      <section className="flex flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow-primary">
              <Clock className="h-5 w-5 text-primary-foreground" />
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
              <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>
                <TabsContent value="login" />
                <TabsContent value="signup" />
              </Tabs>

              <form onSubmit={onSubmit} className="space-y-4 mt-5">
                {tab === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={tab === "login" ? "current-password" : "new-password"}
                    placeholder="Mínimo de 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold bg-gradient-primary shadow-glow-primary hover:opacity-95"
                  disabled={busy || !configured}
                >
                  {busy ? "Aguarde…" : tab === "login" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
