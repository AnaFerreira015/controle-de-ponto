import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { cleanupEntriesBefore, updateProfile } from "@/lib/firestore-service";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações — Controle de Ponto" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { profile, workplaces } = useAppData();
  const [name, setName] = useState("");
  const [expected, setExpected] = useState(8);
  const [retention, setRetention] = useState(12);
  const [mainId, setMainId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmClean, setConfirmClean] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setExpected(profile.dailyExpectedHours);
      setRetention(profile.dataRetentionMonths);
      setMainId(profile.mainWorkplaceId ?? "");
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      await updateProfile(user.uid, {
        name,
        dailyExpectedHours: expected,
        dataRetentionMonths: retention,
        mainWorkplaceId: mainId || null,
      });
      toast.success("Configurações salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function runCleanup() {
    if (!user) return;
    const before = new Date();
    before.setMonth(before.getMonth() - retention);
    setBusy(true);
    try {
      const count = await cleanupEntriesBefore(user.uid, before.getTime());
      toast.success(`${count} registro(s) marcados como excluídos`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
      setConfirmClean(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <Card>
        <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Jornada</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Horas esperadas por dia</Label>
            <Input
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={expected}
              onChange={(e) => setExpected(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label>Local principal</Label>
            <Select value={mainId || "__none__"} onValueChange={(v) => setMainId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {workplaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retenção de dados</CardTitle>
          <CardDescription>Informativo. A limpeza é manual, feita pelo botão abaixo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Manter últimos (meses)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={retention}
              onChange={(e) => setRetention(parseInt(e.target.value) || 12)}
            />
          </div>
          <Button variant="destructive" onClick={() => setConfirmClean(true)} disabled={busy}>
            Limpar dados anteriores a {retention} meses
          </Button>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={busy} className="w-full" size="lg">
        Salvar alterações
      </Button>

      <AlertDialog open={confirmClean} onOpenChange={setConfirmClean}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar limpeza</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os pontos anteriores a {retention} meses serão marcados como excluídos.
              Essa ação será registrada em log e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runCleanup}>Limpar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}