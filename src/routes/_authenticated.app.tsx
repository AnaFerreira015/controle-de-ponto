import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { createTimeEntry } from "@/lib/firestore-service";
import {
  calculateWorkedMinutes,
  checkConsistency,
  endOfDay,
  formatDatetimeLocal,
  formatMinutes,
  formatTime,
  getDayPointStatus,
  getDuePointReminder,
  getEntryStatus,
  getLastEntryType,
  parseDatetimeLocal,
  startOfDay,
  suggestNextType,
  ym,
  ymd,
} from "@/lib/time-utils";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import { getFirstName } from "@/lib/user-display";
import { Bell, Clock3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Bater ponto - Controle de Ponto" },
      { name: "description", content: "Registre entradas, pausas e saídas rapidamente." },
    ],
  }),
  component: AppMain,
});

function AppMain() {
  const { user } = useAuth();
  const { profile, workplaces, entries } = useAppData();
  const [workplaceId, setWorkplaceId] = useState<string>("");
  const [entryType, setEntryType] = useState<EntryType>("entrada");
  const [notes, setNotes] = useState("");
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState<{ msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [delayedOpen, setDelayedOpen] = useState(false);
  const [delayedDatetime, setDelayedDatetime] = useState(formatDatetimeLocal(Date.now()));
  const [delayedType, setDelayedType] = useState<EntryType>("entrada");
  const [delayedWorkplaceId, setDelayedWorkplaceId] = useState("");
  const [delayedNotes, setDelayedNotes] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = endOfDay(new Date()).getTime();
  const todayEntries = useMemo(
    () => entries.filter((e) => e.entryDatetime >= todayStart && e.entryDatetime <= todayEnd),
    [entries, todayStart, todayEnd],
  );
  const monthMinutes = useMemo(
    () => calculateWorkedMinutes(entries, now),
    [entries, now],
  );
  const dayCalc = useMemo(
    () => calculateWorkedMinutes(todayEntries, now),
    [todayEntries, now],
  );
  const lastType = getLastEntryType(todayEntries);
  const suggested = suggestNextType(lastType);
  const dueReminder = useMemo(
    () => getDuePointReminder(profile, todayEntries, now),
    [profile, todayEntries, now],
  );
  const dayStatus = useMemo(
    () => getDayPointStatus(profile, todayEntries, new Date(), now),
    [profile, todayEntries, now],
  );

  useEffect(() => {
    setEntryType(suggested);
  }, [suggested]);

  useEffect(() => {
    if (!workplaceId) {
      if (profile?.mainWorkplaceId) setWorkplaceId(profile.mainWorkplaceId);
      else if (workplaces[0]) setWorkplaceId(workplaces[0].id);
    }
  }, [profile, workplaces, workplaceId]);

  useEffect(() => {
    if (!dueReminder || notificationPermission !== "granted") return;
    const key = `${ymd(new Date(now))}-${dueReminder.entryType}`;
    const storageKey = "last-point-notification";
    if (localStorage.getItem(storageKey) === key) return;

    new Notification("Hora de bater o ponto", {
      body: `Ponto pendente: ${dueReminder.label} (${formatTime(dueReminder.time)}).`,
      icon: "/icon-192.png",
    });
    localStorage.setItem(storageKey, key);
  }, [dueReminder, notificationPermission, now]);

  const expectedMin = (profile?.dailyExpectedHours ?? 8) * 60;
  const dayDiff = dayCalc.minutes - expectedMin;

  const activeWorkplaces = workplaces.filter((w) => w.active && !w.isDeleted);
  const hasWorkplace = activeWorkplaces.length > 0;

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Seu navegador não oferece suporte a notificações.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") toast.success("Notificações ativadas neste navegador");
    else toast.error("Permissão de notificação não concedida");
  }

  async function register(force = false) {
    if (!user || !workplaceId) return;
    if (lastType && todayEntries.length) {
      const last = todayEntries[todayEntries.length - 1];
      if (Date.now() - last.entryDatetime < 60_000 && !force) {
        setConfirm({ msg: "Menos de 1 minuto desde o último ponto. Registrar mesmo assim?" });
        return;
      }
    }
    const warn = checkConsistency(lastType, entryType);
    if (warn && !force) {
      setConfirm({ msg: warn });
      return;
    }
    setBusy(true);
    try {
      await createTimeEntry(user.uid, {
        workplaceId,
        entryType,
        entryDatetime: Date.now(),
        notes,
      });
      toast.success(`${ENTRY_TYPE_LABELS[entryType]} registrada`);
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar");
    } finally {
      setBusy(false);
    }
  }

  async function registerDelayed() {
    if (!user) return;
    const parsedDatetime = parseDatetimeLocal(delayedDatetime);
    if (!delayedWorkplaceId) {
      toast.error("Selecione um local de trabalho");
      return;
    }
    if (!parsedDatetime) {
      toast.error("Informe uma data e hora válidas");
      return;
    }
    if (parsedDatetime > Date.now() + 1000) {
      toast.error("O ponto com atraso não pode ficar no futuro");
      return;
    }
    if (!delayReason.trim()) {
      toast.error("Informe o motivo do atraso");
      return;
    }

    setBusy(true);
    try {
      await createTimeEntry(user.uid, {
        workplaceId: delayedWorkplaceId,
        entryType: delayedType,
        entryDatetime: parsedDatetime,
        notes: delayedNotes,
        delayReason: delayReason.trim(),
      });
      toast.success(`${ENTRY_TYPE_LABELS[delayedType]} registrada com atraso`);
      setDelayedOpen(false);
      setDelayedNotes("");
      setDelayReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar");
    } finally {
      setBusy(false);
    }
  }

  function openDelayedDialog() {
    setDelayedDatetime(formatDatetimeLocal(Date.now()));
    setDelayedType(entryType);
    setDelayedWorkplaceId(workplaceId || activeWorkplaces[0]?.id || "");
    setDelayedNotes(notes);
    setDelayReason("");
    setDelayedOpen(true);
  }

  const greeting = getGreeting();
  const firstName = getFirstName(profile, user, "por aqui");

  const progressPct = Math.max(0, Math.min(100, expectedMin > 0 ? (dayCalc.minutes / expectedMin) * 100 : 0));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {greeting}, <span className="text-gradient-primary">{firstName}</span>
          </h1>
        </div>
        <Badge variant={dayStatus.variant} className="text-xs">
          {dayStatus.label}
        </Badge>
      </div>

      {dueReminder && (
        <Card className="border-destructive/40 shadow-elegant animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Bell className="h-4 w-4" />
              </span>
              <div className="space-y-1">
                <div className="text-sm font-semibold">Ponto pendente</div>
                <p className="text-sm text-muted-foreground">
                  {dueReminder.label} estava previsto para <span className="font-mono font-medium text-foreground">{formatTime(dueReminder.time)}</span>.
                </p>
              </div>
            </div>
            {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
              <Button variant="outline" size="sm" onClick={requestNotificationPermission}>Ativar notificações</Button>
            )}
          </CardContent>
        </Card>
      )}

      {!hasWorkplace ? (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Cadastre um local de trabalho</CardTitle>
            <CardDescription>
              Antes de bater ponto, adicione ao menos um local em{" "}
              <Link to="/locais" className="underline text-primary font-medium">Locais</Link>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="overflow-hidden border-0 shadow-elevated bg-gradient-hero text-primary-foreground">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Bater ponto agora</p>
                <p className="text-primary-foreground/85 text-sm mt-1">
                  Sugestão baseada no seu último registro.
                </p>
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Clock3 className="h-5 w-5" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-primary-foreground/70">Local</label>
                <Select value={workplaceId} onValueChange={setWorkplaceId}>
                  <SelectTrigger className="bg-white/12 border-white/25 text-primary-foreground hover:bg-white/18 focus:ring-white/40 [&_svg]:text-primary-foreground/80">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeWorkplaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-primary-foreground/70">Tipo</label>
                <Select value={entryType} onValueChange={(v) => setEntryType(v as EntryType)}>
                  <SelectTrigger className="bg-white/12 border-white/25 text-primary-foreground hover:bg-white/18 focus:ring-white/40 [&_svg]:text-primary-foreground/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((t) => (
                      <SelectItem key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Textarea
              placeholder="Observação (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-white/12 border-white/25 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-white/40"
            />

            <div className="space-y-2">
              <Button
                size="lg"
                className="w-full h-16 text-base sm:text-lg font-semibold bg-white text-primary hover:bg-white/90 shadow-lg"
                onClick={() => register(false)}
                disabled={busy || !workplaceId}
              >
                Bater ponto — {ENTRY_TYPE_LABELS[entryType]}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-primary-foreground hover:bg-white/12 hover:text-primary-foreground"
                onClick={openDelayedDialog}
                disabled={busy || !workplaceId}
              >
                <Clock3 className="h-4 w-4" /> Registrar ponto com atraso
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-elegant">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Hoje
            </CardTitle>
            <CardDescription>
              {dayCalc.isOpen ? "Expediente em andamento" : "Expediente encerrado"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-bold tracking-tight text-gradient-primary font-mono">
                {formatMinutes(dayCalc.minutes)}
              </span>
              <span className="text-sm text-muted-foreground">de {formatMinutes(expectedMin)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-sm font-medium">
              {dayDiff >= 0 ? (
                <span style={{ color: "var(--success)" }}>+{formatMinutes(dayDiff)} de saldo</span>
              ) : (
                <span className="text-destructive">{formatMinutes(dayDiff)} restante</span>
              )}
            </div>
            <ul className="text-sm space-y-2 pt-3 border-t border-border">
              {todayEntries.filter((e) => !e.isDeleted).length === 0 ? (
                <li className="text-muted-foreground py-2">Nenhum ponto hoje ainda.</li>
              ) : (
                todayEntries
                  .filter((e) => !e.isDeleted)
                  .map((e) => {
                    const status = getEntryStatus(e);
                    return (
                      <li key={e.id} className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                        <div className="flex justify-between gap-2 items-center">
                          <span className="font-medium text-sm">
                            {ENTRY_TYPE_LABELS[e.entryType]}
                            {e.isEdited && <span className="ml-1 text-muted-foreground">✎</span>}
                          </span>
                          <span className="font-mono text-sm tabular-nums">{formatTime(e.entryDatetime)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {e.notes && <span className="text-muted-foreground truncate">Obs.: {e.notes}</span>}
                        </div>
                      </li>
                    );
                  })
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Este mês
            </CardTitle>
            <CardDescription className="capitalize">
              {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <span className="text-4xl font-bold tracking-tight font-mono">{formatMinutes(monthMinutes.minutes)}</span>
            <p className="text-sm text-muted-foreground">
              {entries.filter((e) => !e.isDeleted).length} pontos registrados no mês {ym(new Date())}
            </p>
            <Link
              to="/historico"
              className="inline-flex items-center text-sm font-medium text-primary hover:underline pt-2"
            >
              Ver histórico completo →
            </Link>
          </CardContent>
        </Card>
      </div>


      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar registro</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.msg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null);
                register(true);
              }}
            >
              Registrar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={delayedOpen} onOpenChange={setDelayedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar ponto com atraso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Data e hora do ponto</Label>
              <Input
                type="datetime-local"
                step={1}
                value={delayedDatetime}
                onChange={(e) => setDelayedDatetime(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Local</Label>
                <Select value={delayedWorkplaceId} onValueChange={setDelayedWorkplaceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeWorkplaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={delayedType} onValueChange={(v) => setDelayedType(v as EntryType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((t) => (
                      <SelectItem key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Motivo do atraso</Label>
              <Input value={delayReason} onChange={(e) => setDelayReason(e.target.value)} placeholder="Ex.: esqueci de bater no horário" />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea rows={2} value={delayedNotes} onChange={(e) => setDelayedNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelayedOpen(false)}>Cancelar</Button>
            <Button onClick={registerDelayed} disabled={busy}>Registrar com atraso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
