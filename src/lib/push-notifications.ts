import { deleteToken, getToken, onMessage, type MessagePayload } from "firebase/messaging";
import {
  firebaseVapidKey,
  getFirebaseClientConfig,
  getFirebaseMessaging,
  isFirebaseConfigured,
  isFirebaseMessagingSupported,
} from "./firebase";
import { disableNotificationToken, saveNotificationToken } from "./firestore-service";

const TOKEN_STORAGE_KEY = "controle-ponto-fcm-token";

export interface PushSupportStatus {
  supported: boolean;
  reason?: string;
}

export async function getPushSupportStatus(): Promise<PushSupportStatus> {
  if (!isFirebaseConfigured) {
    return { supported: false, reason: "Firebase não configurado." };
  }
  if (!firebaseVapidKey) {
    return { supported: false, reason: "Configure VITE_FIREBASE_VAPID_KEY para ativar push real." };
  }
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { supported: false, reason: "Notificações push só funcionam no navegador." };
  }
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "Este navegador não oferece suporte a service worker." };
  }
  if (!("Notification" in window)) {
    return { supported: false, reason: "Este navegador não oferece suporte a notificações." };
  }
  if (!(await isFirebaseMessagingSupported())) {
    return { supported: false, reason: "Firebase Messaging não é suportado neste navegador." };
  }
  return { supported: true };
}

export async function enablePushNotifications(uid: string): Promise<string> {
  const support = await getPushSupportStatus();
  if (!support.supported) throw new Error(support.reason ?? "Push não suportado.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação não concedida.");
  }

  const registration = await registerMessagingServiceWorker();
  const messaging = await getFirebaseMessaging();
  if (!messaging) throw new Error("Firebase Messaging não inicializado.");

  const token = await getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("Não foi possível gerar o token de push neste navegador.");
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  await saveNotificationToken(uid, token, { userAgent: navigator.userAgent });
  return token;
}

export async function disablePushNotifications(uid: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const messaging = await getFirebaseMessaging();

  if (token) {
    await disableNotificationToken(uid, token);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  if (messaging) {
    await deleteToken(messaging).catch(() => undefined);
  }
}

export async function listenToForegroundPush(
  cb: (payload: MessagePayload) => void,
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => undefined;
  return onMessage(messaging, cb);
}

export function getStoredPushToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration> {
  const config = getFirebaseClientConfig();
  const params = new URLSearchParams({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });

  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`, {
    scope: "/",
  });
}
