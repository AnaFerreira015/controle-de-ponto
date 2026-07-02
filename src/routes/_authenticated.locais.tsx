import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { createWorkplace, deleteWorkplace, updateWorkplace } from "@/lib/firestore-service";
import type { Workplace } from "@/lib/types";
import { MapPin as MapPinIcon, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/locais")({
  head: () => ({
    meta: [{ title: "Locais - Controle de Ponto" }],
  }),
  component: LocaisPage,
});

function LocaisPage() {
  const { user } = useAuth();
  const { workplaces } = useAppData();
  const [editing, setEditing] = useState<Workplace | null>(null);
  const [deleting, setDeleting] = useState<Workplace | null>(null);
  const [creating, setCreating] = useState(false);

  const visibleWorkplaces = useMemo(
    () => workplaces.filter((w) => !w.isDeleted),
    [workplaces],
  );

  async function confirmDelete() {
    if (!user || !deleting) return;
    try {
      await deleteWorkplace(user.uid, deleting.id);
      toast.success("Local excluído");
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir local");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Locais</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Locais de trabalho
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastre um ou mais locais onde você bate ponto.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-gradient-primary shadow-glow-primary hover:opacity-95">
          <Plus className="h-4 w-4 mr-1" />Novo local
        </Button>
      </div>

      {visibleWorkplaces.length === 0 ? (
        <Card className="shadow-elegant border-dashed">
          <CardHeader className="text-center py-12">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <Plus className="h-6 w-6" />
            </span>
            <CardTitle>Nenhum local cadastrado</CardTitle>
            <CardDescription>Adicione seu primeiro local para começar a bater ponto.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {visibleWorkplaces.map((w) => (
            <Card key={w.id} className="shadow-elegant hover:shadow-elevated transition-shadow">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${w.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <MapPinIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      {w.name}
                      {!w.active && <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">inativo</span>}
                    </div>
                    {w.description && <div className="text-sm text-muted-foreground truncate">{w.description}</div>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(w)} aria-label={`Editar ${w.name}`} className="rounded-full">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(w)} aria-label={`Excluir ${w.name}`} className="rounded-full">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}


      <WorkplaceDialog
        open={creating}
        onOpenChange={setCreating}
        onSave={async (data) => {
          if (!user) return;
          await createWorkplace(user.uid, data);
          toast.success("Local criado");
          setCreating(false);
        }}
      />
      <WorkplaceDialog
        open={!!editing}
        initial={editing ?? undefined}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={async (data, active) => {
          if (!user || !editing) return;
          await updateWorkplace(user.uid, editing.id, { ...data, active: active ?? editing.active });
          toast.success("Local atualizado");
          setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir local de trabalho?</AlertDialogTitle>
            <AlertDialogDescription>
              O local “{deleting?.name}” será removido da lista de locais disponíveis. Registros antigos continuarão preservados no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir local</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WorkplaceDialog({
  open,
  onOpenChange,
  onSave,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: { name: string; description: string }, active?: boolean) => Promise<void>;
  initial?: Workplace;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setName(initial?.name ?? "");
          setDescription(initial?.description ?? "");
          setActive(initial?.active ?? true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar local" : "Novo local"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {initial && (
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave({ name: name.trim(), description: description.trim() }, active);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              } finally {
                setBusy(false);
              }
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
