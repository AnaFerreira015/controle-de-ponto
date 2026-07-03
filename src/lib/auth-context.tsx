import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as fbUpdateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { getOrCreateProfile } from "./firestore-service";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      async signIn(email, password) {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      async signUp(name, email, password) {
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
        if (name) await fbUpdateProfile(cred.user, { displayName: name });
        await getOrCreateProfile(cred.user.uid, email, name);
      },
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const cred = await signInWithPopup(getFirebaseAuth(), provider);
        // getOrCreateProfile é idempotente: se o usuário já existir no
        // Firestore, apenas retorna o perfil existente sem sobrescrever dados.
        await getOrCreateProfile(
          cred.user.uid,
          cred.user.email ?? "",
          cred.user.displayName ?? "",
        );
      },
      async logout() {
        await signOut(getFirebaseAuth());
      },
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth deve estar dentro de <AuthProvider>");
  return v;
}