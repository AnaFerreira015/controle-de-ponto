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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{greeting}, {firstName}</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
      </div>

      {dueReminder && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="h-4 w-4 text-destructive" />
                Ponto pendente
              </div>
              <p className="text-sm text-muted-foreground">
                {dueReminder.label} estava previsto para {formatTime(dueReminder.time)}.
              </p>
            </div>
            {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
              <Button variant="outline" size="sm" onClick={requestNotificationPermission}>Ativar notificações</Button>
            )}
          </CardContent>
        </Card>
      )}

      {!hasWorkplace ? (
        <Card>
          <CardHeader>
            <CardTitle>Cadastre um local de trabalho</CardTitle>
            <CardDescription>
              Antes de bater ponto, adicione ao menos um local em <Link to="/locais" className="underline text-primary">Locais</Link>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle>Bater ponto agora</CardTitle>
            <CardDescription>Sugestão automática baseada no seu último registro do dia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Local</label>
                <Select value={workplaceId} onValueChange={setWorkplaceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeWorkplaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Select value={entryType} onValueChange={(v) => setEntryType(v as EntryType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
            />
            <Button
              size="lg"
              className="w-full h-16 text-lg font-semibold"
              onClick={() => register(false)}
              disabled={busy || !workplaceId}
            >
              Bater ponto - {ENTRY_TYPE_LABELS[entryType]}
            </Button>
            <Button variant="outline" className="w-full" onClick={openDelayedDialog} disabled={busy || !workplaceId}>
              <Clock3 className="h-4 w-4" /> Registrar ponto com atraso
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Hoje
              <Badge variant={dayStatus.variant}>{dayStatus.label}</Badge>
            </CardTitle>
            <CardDescription>
              {dayCalc.isOpen ? "Expediente em andamento" : "Expediente encerrado"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-primary">{formatMinutes(dayCalc.minutes)}</span>
              <span className="text-sm text-muted-foreground">de {formatMinutes(expectedMin)}</span>
            </div>
            <div className="text-sm">
              {dayDiff >= 0 ? (
                <span style={{ color: "var(--success)" }}>+{formatMinutes(dayDiff)} de saldo</span>
              ) : (
                <span className="text-destructive">{formatMinutes(dayDiff)} restante</span>
              )}
            </div>
            <ul className="text-sm text-muted-foreground space-y-2 pt-2 border-t border-border">
              {todayEntries.filter((e) => !e.isDeleted).length === 0 ? (
                <li>Nenhum ponto hoje.</li>
              ) : (
                todayEntries
                  .filter((e) => !e.isDeleted)
                  .map((e) => {
                    const status = getEntryStatus(e);
                    return (
                      <li key={e.id} className="space-y-1">
                        <div className="flex justify-between gap-2">
                          <span>{ENTRY_TYPE_LABELS[e.entryType]}{e.isEdited && " ✎"}</span>
                          <span className="font-mono">{formatTime(e.entryDatetime)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {e.notes && <span className="text-muted-foreground">Obs.: {e.notes}</span>}
                        </div>
                      </li>
                    );
                  })
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Este mês</CardTitle>
            <CardDescription>{ym(new Date())}</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{formatMinutes(monthMinutes.minutes)}</span>
            <p className="text-sm text-muted-foreground mt-1">
              {entries.filter((e) => !e.isDeleted).length} pontos registrados
            </p>
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
