import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const firebaseVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let messagingInstance: Messaging | null = null;
let messagingSupport: Promise<boolean> | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase não configurado. Defina as variáveis VITE_FIREBASE_* (veja FIREBASE_SETUP.md).",
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp());
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(ensureApp());
  return dbInstance;
}

export function getFirebaseClientConfig() {
  return { ...config };
}

export async function isFirebaseMessagingSupported(): Promise<boolean> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  if (!messagingSupport) {
    messagingSupport = isSupported().catch(() => false);
  }
  return messagingSupport;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!(await isFirebaseMessagingSupported())) return null;
  if (!messagingInstance) messagingInstance = getMessaging(ensureApp());
  return messagingInstance;
}