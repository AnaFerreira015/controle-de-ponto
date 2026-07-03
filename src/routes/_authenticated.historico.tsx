import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { editTimeEntry, softDeleteEntry } from "@/lib/firestore-service";
import {
  calculateWorkedMinutes,
  entriesToCsv,
  formatDate,
  formatMinutes,
  formatTime,
  getDayPointStatus,
  getEntryStatus,
  startOfDay,
  ym,
  ymd,
} from "@/lib/time-utils";
import { ENTRY_TYPE_LABELS, type EntryType, type TimeEntry } from "@/lib/types";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [{ title: "Histórico - Controle de Ponto" }],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { profile, workplaces, entries, entryMonthKeys, viewMonth, setViewMonth } = useAppData();
  const [editing, setEditing] = useState<TimeEntry | null>(null);

  const workplaceNames = useMemo(
    () => Object.fromEntries(workplaces.map((w) => [w.id, w.name])),
    [workplaces],
  );

  const availableMonths = useMemo(() => [...entryMonthKeys].sort(), [entryMonthKeys]);
  const currentMonthKey = ym(new Date());
  const viewMonthKey = ym(viewMonth);
  const availableOrCurrentMonths = useMemo(() => {
    const values = new Set(availableMonths);
    values.add(currentMonthKey);
    return Array.from(values).sort();
  }, [availableMonths, currentMonthKey]);

  const previousMonthKey = useMemo(
    () => [...availableMonths].reverse().find((key) => key < viewMonthKey) ?? null,
    [availableMonths, viewMonthKey],
  );
  const nextMonthKey = useMemo(
    () => availableMonths.find((key) => key > viewMonthKey) ?? null,
    [availableMonths, viewMonthKey],
  );

  const days = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      const key = ymd(new Date(e.entryDatetime));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const monthTotal = calculateWorkedMinutes(entries);

  const monthLabel = useMemo(
    () => viewMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [viewMonth],
  );

  const { lateCount, pendingCount } = useMemo(() => {
    let lateCount = 0;
    for (const e of entries) {
      if (!e.isDeleted && getEntryStatus(e).label === "Registrado com atraso") lateCount++;
    }
    let pendingCount = 0;
    for (const [, list] of days) {
      const status = getDayPointStatus(profile, list, new Date(list[0].entryDatetime));
      if (status.variant === "outline" || status.variant === "destructive") pendingCount++;
    }
    return { lateCount, pendingCount };
  }, [entries, days, profile]);

  function setMonthFromKey(monthKey: string) {
    setViewMonth(dateFromMonthKey(monthKey));
  }

  function selectMonth(monthKey: string) {
    if (!monthKey) return;
    if (monthKey !== currentMonthKey && !availableMonths.includes(monthKey)) {
      toast.info(
        "Não há registros nesse mês. O histórico mantém apenas meses com dados ou o mês atual.",
      );
      return;
    }
    setMonthFromKey(monthKey);
  }

  function exportCsv() {
    const csv = entriesToCsv(entries, workplaceNames);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pontos-${ym(viewMonth)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Histórico</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Seus pontos, mês a mês
          </h1>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card shadow-elegant p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => previousMonthKey && setMonthFromKey(previousMonthKey)}
              disabled={!previousMonthKey}
              aria-label="Ir para o mês anterior com registros"
              className="rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[9ch] text-center capitalize px-2">
              {viewMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => nextMonthKey && setMonthFromKey(nextMonthKey)}
              disabled={!nextMonthKey}
              aria-label="Ir para o próximo mês com registros"
              className="rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="history-month" className="sr-only">
                Escolher mês
              </Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="history-month"
                  type="month"
                  value={viewMonthKey}
                  list="history-months"
                  onChange={(e) => selectMonth(e.target.value)}
                  className="pl-9 w-full sm:w-[12rem]"
                />
              </div>
              <datalist id="history-months">
                {availableOrCurrentMonths.map((monthKey) => (
                  <option key={monthKey} value={monthKey} />
                ))}
              </datalist>
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={!entries.length}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      <Card className="border border-white/10 bg-gradient-primary text-white shadow-elevated">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest font-semibold text-white">
                Total do mês
              </p>
              <p className="text-white text-sm mt-0.5">
                {entries.filter((e) => !e.isDeleted).length} pontos registrados em {monthLabel}
              </p>
            </div>
            <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums">
              {formatMinutes(monthTotal.minutes)}
            </span>
          </div>
          {(lateCount > 0 || pendingCount > 0) && (
            <div className="rounded-xl border border-white/20 bg-white/15 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                Atenção
              </div>
              <p className="mt-1 text-white">
                {lateCount > 0 &&
                  `${lateCount} ponto${lateCount > 1 ? "s" : ""} registrado${lateCount > 1 ? "s" : ""} com atraso`}
                {lateCount > 0 && pendingCount > 0 && " e "}
                {pendingCount > 0 &&
                  `${pendingCount} dia${pendingCount > 1 ? "s" : ""} com registro${pendingCount > 1 ? "s" : ""} pendente${pendingCount > 1 ? "s" : ""}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {days.length === 0 ? (
        <Card className="shadow-elegant">
          <CardContent className="p-10 text-center text-muted-foreground">
            <CalendarDays className="mx-auto h-8 w-8 mb-3 opacity-50" />
            Nenhum registro neste mês.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {days.map(([key, list]) => {
            const dayCalc = calculateWorkedMinutes(list);
            const date = new Date(list[0].entryDatetime);
            const dayStatus = getDayPointStatus(profile, list, date);
            return (
              <Card key={key} className="shadow-elegant hover:shadow-elevated transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex justify-between items-start gap-3 text-base">
                    <div className="space-y-1.5">
                      <span className="capitalize text-base font-semibold">
                        {date.toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}
                      </span>
                      <div>
                        <Badge variant={dayStatus.variant}>{dayStatus.label}</Badge>
                      </div>
                    </div>
                    <span className="text-primary font-mono text-lg tabular-nums">
                      {formatMinutes(dayCalc.minutes)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {list
                    .filter((e) => !e.isDeleted)
                    .sort((a, b) => a.entryDatetime - b.entryDatetime)
                    .map((e) => {
                      const status = getEntryStatus(e);
                      return (
                        <div
                          key={e.id}
                          className="flex items-start justify-between gap-3 text-sm py-2.5 border-b border-border last:border-0"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono tabular-nums w-[5.5rem] font-medium">
                                {formatTime(e.entryDatetime)}
                              </span>
                              <span className="font-medium">{ENTRY_TYPE_LABELS[e.entryType]}</span>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {workplaceNames[e.workplaceId] ?? ""}
                            </div>
                            {e.notes && (
                              <div className="text-xs text-muted-foreground">Obs.: {e.notes}</div>
                            )}
                            {e.delayReason && (
                              <div className="text-xs text-muted-foreground">
                                Motivo do atraso: {e.delayReason}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(e)}
                            aria-label="Editar ponto"
                            className="rounded-full"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EditEntryDialog entry={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditEntryDialog({ entry, onClose }: { entry: TimeEntry | null; onClose: () => void }) {
  const { user } = useAuth();
  const [time, setTime] = useState("");
  const [type, setType] = useState<EntryType>("entrada");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entry) return;
    const d = new Date(entry.entryDatetime);
    setTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`,
    );
    setType(entry.entryType);
    setNotes(entry.notes ?? "");
    setReason("");
  }, [entry]);

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar ponto</DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{formatDate(entry.entryDatetime)}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Hora</Label>
                <Input
                  type="time"
                  step={1}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {ENTRY_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo da alteração</Label>
              <Input
                placeholder="Ex.: esqueci de bater no horário"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="destructive"
            disabled={!entry || !user || busy}
            onClick={async () => {
              if (!user || !entry) return;
              if (!confirm("Excluir este ponto?")) return;
              setBusy(true);
              try {
                await softDeleteEntry(user.uid, entry, reason || "Sem motivo informado");
                toast.success("Ponto excluído");
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!entry || !user || !reason.trim() || busy}
              onClick={async () => {
                if (!user || !entry) return;
                const [h, m, sec] = time.split(":").map((x) => parseInt(x, 10));
                const d = startOfDay(new Date(entry.entryDatetime));
                d.setHours(h || 0, m || 0, sec || 0, 0);
                setBusy(true);
                try {
                  await editTimeEntry(
                    user.uid,
                    entry,
                    {
                      entryDatetime: d.getTime(),
                      notes,
                      entryType: type,
                    },
                    reason.trim(),
                  );
                  toast.success("Ponto atualizado");
                  onClose();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function dateFromMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map((value) => parseInt(value, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return new Date();
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}
