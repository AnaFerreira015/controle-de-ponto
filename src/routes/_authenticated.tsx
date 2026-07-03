import { createFileRoute, Link, Navigate, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppDataProvider, useAppData } from "@/lib/app-data-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, History, MapPin, Settings, LogOut, Sun, Moon, User as UserIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getOrCreateProfile } from "@/lib/firestore-service";
import { getDisplayName, getFirstName } from "@/lib/user-display";
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
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-sm">Carregando…</span>
        </div>
      </div>
    );
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
  const firstName = getFirstName(profile, user, "Usuário");
  const initial = (firstName || displayName || "U").trim().charAt(0).toUpperCase();

  const items = [
    { to: "/app", label: "Ponto", icon: Clock },
    { to: "/historico", label: "Histórico", icon: History },
    { to: "/locais", label: "Locais", icon: MapPin },
    { to: "/configuracoes", label: "Ajustes", icon: Settings },
  ] as const;

  return (
    <div className="min-h-dvh text-foreground flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b border-border/60 glass-surface">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-16">
          <Link to="/app" className="flex items-center gap-2.5 group">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow-primary transition-transform group-hover:scale-105 text-white">
              <Clock className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">Controle de Ponto</span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Sua jornada, no seu bolso
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
              className="rounded-full"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-1 flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-accent transition-colors"
                  aria-label="Abrir menu do usuário"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-white font-semibold text-sm shadow-sm">
                    {initial}
                  </span>
                  <span className="hidden sm:inline text-sm font-medium max-w-[10rem] truncate">
                    {firstName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium truncate">{displayName}</span>
                  {user?.email && (
                    <span className="text-xs text-muted-foreground truncate font-normal">
                      {user.email}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes" className="cursor-pointer">
                    <UserIcon className="mr-2 h-4 w-4" />
                    Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Desktop tabs (below header, above main) */}
      <nav
        aria-label="Navegação principal"
        className="hidden sm:block sticky top-16 z-20 border-b border-border/60 glass-surface"
      >
        <div className="max-w-3xl mx-auto px-4 flex gap-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-md -mb-px transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main id="main-content" className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-28 sm:pb-10">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Navegação principal móvel"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-border/60 glass-surface safe-bottom sm:hidden"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-4 px-2 pt-1.5">
          {items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-xs font-medium relative group"
              >
                <span
                  className={`inline-flex h-9 w-16 items-center justify-center rounded-full transition-all ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground group-hover:text-foreground group-hover:bg-muted"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className={active ? "text-primary" : "text-muted-foreground"}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

