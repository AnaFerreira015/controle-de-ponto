import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  startOfDay,
  ym,
  ymd,
} from "@/lib/time-utils";
import { ENTRY_TYPE_LABELS, type EntryType, type TimeEntry } from "@/lib/types";
import { ChevronLeft, ChevronRight, Download, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [{ title: "Histórico — Controle de Ponto" }],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { workplaces, entries, viewMonth, setViewMonth } = useAppData();
  const [editing, setEditing] = useState<TimeEntry | null>(null);

  const workplaceNames = useMemo(
    () => Object.fromEntries(workplaces.map((w) => [w.id, w.name])),
    [workplaces],
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

  function shift(delta: number) {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + delta);
    setViewMonth(d);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-semibold min-w-[9ch] text-center">
            {viewMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </h1>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!entries.length}>
          <Download className="h-4 w-4 mr-1" />CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex items-baseline justify-between">
          <span className="text-muted-foreground">Total do mês</span>
          <span className="text-2xl font-bold text-primary">{formatMinutes(monthTotal.minutes)}</span>
        </CardContent>
      </Card>

      {days.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum registro neste mês.</CardContent></Card>
      ) : (
        days.map(([key, list]) => {
          const dayCalc = calculateWorkedMinutes(list);
          const date = new Date(list[0].entryDatetime);
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-baseline text-base">
                  <span>{date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                  <span className="text-primary">{formatMinutes(dayCalc.minutes)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {list
                  .filter((e) => !e.isDeleted)
                  .sort((a, b) => a.entryDatetime - b.entryDatetime)
                  .map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono w-12">{formatTime(e.entryDatetime)}</span>
                        <span>{ENTRY_TYPE_LABELS[e.entryType]}</span>
                        {e.isEdited && <span className="text-xs text-muted-foreground">(editado)</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground truncate max-w-[8rem]">{workplaceNames[e.workplaceId] ?? ""}</span>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          );
        })
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

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(o) => {
        if (!o) onClose();
        else if (entry) {
          const d = new Date(entry.entryDatetime);
          setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
          setType(entry.entryType);
          setNotes(entry.notes);
          setReason("");
        }
      }}
    >
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
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
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
              <Label>Observação</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo da alteração</Label>
              <Input placeholder="Ex.: esqueci de bater no horário" value={reason} onChange={(e) => setReason(e.target.value)} />
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
            <Trash2 className="h-4 w-4 mr-1" />Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              disabled={!entry || !user || !reason.trim() || busy}
              onClick={async () => {
                if (!user || !entry) return;
                const [h, m] = time.split(":").map((x) => parseInt(x, 10));
                const d = startOfDay(new Date(entry.entryDatetime));
                d.setHours(h || 0, m || 0, 0, 0);
                setBusy(true);
                try {
                  await editTimeEntry(user.uid, entry, {
                    entryDatetime: d.getTime(),
                    notes,
                    entryType: type,
                  }, reason.trim());
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