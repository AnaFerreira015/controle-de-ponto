import { createFileRoute, Link, Navigate, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppDataProvider, useAppData } from "@/lib/app-data-context";
import { Button } from "@/components/ui/button";
import { Clock, History, MapPin, Settings, LogOut, Sun, Moon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getOrCreateProfile } from "@/lib/firestore-service";
import { getDisplayName } from "@/lib/user-display";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (user) {
      getOrCreateProfile(user.uid, user.email ?? "", user.displayName ?? "").catch((e) =>
        console.error(e),
      );
    }
  }, [user]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppDataProvider>
      <Shell onLogout={logout}>
        <Outlet />
      </Shell>
    </AppDataProvider>
  );
}

function Shell({ children, onLogout }: { children: ReactNode; onLogout: () => Promise<void> }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAppData();
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* noop */
    }
  }

  async function handleLogout() {
    try {
      await onLogout();
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sair");
    }
  }

  const displayName = getDisplayName(profile, user, "Usuário");

  const items = [
    { to: "/app", label: "Ponto", icon: Clock },
    { to: "/historico", label: "Histórico", icon: History },
    { to: "/locais", label: "Locais", icon: MapPin },
    { to: "/configuracoes", label: "Ajustes", icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-semibold">Controle de Ponto</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="max-w-[8rem] truncate text-sm text-muted-foreground mr-1 sm:max-w-[12rem] sm:mr-2">
              {displayName}
            </span>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-card border-t border-border">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}