import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useAppData } from "@/lib/app-data-context";
import { cleanupEntriesBefore, updateProfile } from "@/lib/firestore-service";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSupportStatus,
  getStoredPushToken,
  type PushSupportStatus,
} from "@/lib/push-notifications";
import { sanitizeDisplayName } from "@/lib/user-display";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações - Controle de Ponto" }],
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
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [lunchStartTime, setLunchStartTime] = useState("12:00");
  const [lunchEndTime, setLunchEndTime] = useState("13:00");
  const [workEndTime, setWorkEndTime] = useState("17:00");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLeadMinutes, setNotificationLeadMinutes] = useState(0);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushSupportStatus>({ supported: false });
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [busy, setBusy] = useState(false);
  const [confirmClean, setConfirmClean] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(sanitizeDisplayName(profile.name));
      setExpected(profile.dailyExpectedHours);
      setRetention(profile.dataRetentionMonths);
      setMainId(profile.mainWorkplaceId ?? "");
      setWorkStartTime(profile.workStartTime ?? "08:00");
      setLunchStartTime(profile.lunchStartTime ?? "12:00");
      setLunchEndTime(profile.lunchEndTime ?? "13:00");
      setWorkEndTime(profile.workEndTime ?? "17:00");
      setNotificationsEnabled(profile.notificationsEnabled ?? false);
      setNotificationLeadMinutes(normalizeNotificationLeadMinutes(profile.notificationLeadMinutes));
      setPushNotificationsEnabled(profile.pushNotificationsEnabled ?? false);
    }
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
    getPushSupportStatus().then(setPushStatus);
    setPushToken(getStoredPushToken());
  }, []);

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

  async function enablePush() {
    if (!user) return;
    setBusy(true);
    try {
      const token = await enablePushNotifications(user.uid);
      setPushToken(token);
      setPushNotificationsEnabled(true);
      setNotificationsEnabled(true);
      await updateProfile(user.uid, {
        notificationsEnabled: true,
        pushNotificationsEnabled: true,
      });
      toast.success("Push real ativado neste dispositivo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ativar push");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!user) return;
    setBusy(true);
    try {
      await disablePushNotifications(user.uid);
      setPushToken(null);
      setPushNotificationsEnabled(false);
      await updateProfile(user.uid, { pushNotificationsEnabled: false });
      toast.success("Push desativado neste dispositivo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desativar push");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      await updateProfile(user.uid, {
        name,
        dailyExpectedHours: expected,
        dataRetentionMonths: retention,
        mainWorkplaceId: mainId || null,
        workStartTime,
        lunchStartTime,
        lunchEndTime,
        workEndTime,
        notificationsEnabled,
        notificationLeadMinutes: normalizeNotificationLeadMinutes(notificationLeadMinutes),
        pushNotificationsEnabled,
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
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Configurações</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">Preferências</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ajuste seu perfil, jornada, notificações e retenção de dados.
        </p>
      </div>


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
                {workplaces
                  .filter((w) => !w.isDeleted)
                  .map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horários de trabalho</CardTitle>
          <CardDescription>Esses horários são usados para status de atraso e notificações locais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Entrada</Label>
              <Input type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Saída p/ almoço</Label>
              <Input type="time" value={lunchStartTime} onChange={(e) => setLunchStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Volta do almoço</Label>
              <Input type="time" value={lunchEndTime} onChange={(e) => setLunchEndTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Saída</Label>
              <Input type="time" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações de ponto</CardTitle>
          <CardDescription>
            As notificações usam o navegador e funcionam enquanto o app estiver aberto ou em segundo plano permitido pelo celular.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <Label>Ativar lembretes</Label>
              <p className="text-xs text-muted-foreground">Avisar quando chegar o horário previsto de bater ponto.</p>
            </div>
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
          </div>
          <div className="space-y-1">
            <Label>Antecedência do aviso (minutos)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={Number.isFinite(notificationLeadMinutes) ? notificationLeadMinutes : 0}
              onChange={(e) => setNotificationLeadMinutes(normalizeNotificationLeadMinutes(e.target.value))}
            />
          </div>
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <Button variant="outline" type="button" onClick={requestNotificationPermission}>
              Permitir notificações neste navegador
            </Button>
          )}
          {notificationPermission === "unsupported" && (
            <p className="text-sm text-muted-foreground">Este navegador não informou suporte a notificações.</p>
          )}
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Push/offline real neste dispositivo</Label>
              </div>
              <Switch
                checked={pushNotificationsEnabled && Boolean(pushToken)}
                onCheckedChange={(checked) => {
                  if (checked) enablePush();
                  else disablePush();
                }}
                disabled={busy || !pushStatus.supported}
              />
            </div>
            {!pushStatus.supported && (
              <p className="text-xs text-muted-foreground">
                {pushStatus.reason ?? "Push real não está disponível neste navegador."}
              </p>
            )}
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

      <Button onClick={save} disabled={busy} className="w-full h-12 text-base font-semibold text-white bg-gradient-primary shadow-glow-primary hover:opacity-95" size="lg">
        {busy ? "Salvando…" : "Salvar alterações"}
      </Button>

      <div className="h-8 sm:h-0" aria-hidden="true" />

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

function normalizeNotificationLeadMinutes(value: unknown): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : 0;

  if (!Number.isFinite(parsed)) return 0;
  return Math.min(120, Math.max(0, Math.trunc(parsed)));
}