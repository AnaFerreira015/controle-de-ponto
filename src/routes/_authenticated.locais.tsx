import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { createWorkplace, updateWorkplace } from "@/lib/firestore-service";
import type { Workplace } from "@/lib/types";
import { Pencil, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/locais")({
  head: () => ({
    meta: [{ title: "Locais — Controle de Ponto" }],
  }),
  component: LocaisPage,
});

function LocaisPage() {
  const { user } = useAuth();
  const { workplaces } = useAppData();
  const [editing, setEditing] = useState<Workplace | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Locais de trabalho</h1>
          <p className="text-muted-foreground text-sm">Cadastre um ou mais locais onde você bate ponto.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      </div>

      {workplaces.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum local cadastrado</CardTitle>
            <CardDescription>Adicione seu primeiro local para começar.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {workplaces.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {w.name}
                    {!w.active && <span className="text-xs text-muted-foreground">(inativo)</span>}
                  </div>
                  {w.description && <div className="text-sm text-muted-foreground">{w.description}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(w)}>
                  <Pencil className="h-4 w-4" />
                </Button>
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