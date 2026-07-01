import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock } from "lucide-react";

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
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-primary">
        <Clock className="h-8 w-8" />
        <h1 className="text-2xl font-semibold text-foreground">Controle de Ponto</h1>
      </div>

      {!configured && (
        <Card className="w-full max-w-md mb-4 border-warning" style={{ borderColor: "var(--warning)" }}>
          <CardHeader>
            <CardTitle>Firebase não configurado</CardTitle>
            <CardDescription>
              Defina as variáveis <code>VITE_FIREBASE_*</code>. Veja o arquivo <code>FIREBASE_SETUP.md</code> na raiz do projeto.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bem-vindo</CardTitle>
          <CardDescription>Entre ou crie sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="login" />
            <TabsContent value="signup" />
          </Tabs>

          <form onSubmit={onSubmit} className="space-y-4 mt-4">
            {tab === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy || !configured}>
              {busy ? "Aguarde…" : tab === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}