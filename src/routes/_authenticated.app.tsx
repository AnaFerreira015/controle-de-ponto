import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { createTimeEntry } from "@/lib/firestore-service";
import {
  calculateWorkedMinutes,
  checkConsistency,
  formatMinutes,
  formatTime,
  getLastEntryType,
  startOfDay,
  suggestNextType,
  ym,
} from "@/lib/time-utils";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import { getFirstName } from "@/lib/user-display";

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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const todayStart = startOfDay(new Date()).getTime();
  const todayEntries = useMemo(
    () => entries.filter((e) => e.entryDatetime >= todayStart),
    [entries, todayStart],
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

  useEffect(() => {
    setEntryType(suggested);
  }, [suggested]);

  useEffect(() => {
    if (!workplaceId) {
      if (profile?.mainWorkplaceId) setWorkplaceId(profile.mainWorkplaceId);
      else if (workplaces[0]) setWorkplaceId(workplaces[0].id);
    }

  }, [profile, workplaces, workplaceId]);

  const expectedMin = (profile?.dailyExpectedHours ?? 8) * 60;
  const dayDiff = dayCalc.minutes - expectedMin;

  const activeWorkplaces = workplaces.filter((w) => w.active && !w.isDeleted);
  const hasWorkplace = activeWorkplaces.length > 0;

  async function register(force = false) {
    if (!user || !workplaceId) return;
    // < 1 min from last?
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hoje</CardTitle>
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
            <ul className="text-sm text-muted-foreground space-y-1 pt-2 border-t border-border">
              {todayEntries.length === 0 ? (
                <li>Nenhum ponto hoje.</li>
              ) : (
                todayEntries
                  .filter((e) => !e.isDeleted)
                  .map((e) => (
                    <li key={e.id} className="flex justify-between">
                      <span>{ENTRY_TYPE_LABELS[e.entryType]}{e.isEdited && " ✎"}</span>
                      <span>{formatTime(e.entryDatetime)}</span>
                    </li>
                  ))
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
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}