import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  subscribeEntriesInRange,
  subscribeProfile,
  subscribeWorkplaces,
} from "./firestore-service";
import { startOfMonth, endOfMonth } from "./time-utils";
import type { TimeEntry, UserProfile, Workplace } from "./types";
import { useAuth } from "./auth-context";

interface AppData {
  profile: UserProfile | null;
  workplaces: Workplace[];
  entries: TimeEntry[]; // current month + previous/next month window? for now: current month
  loading: boolean;
  viewMonth: Date;
  setViewMonth: (d: Date) => void;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubP = subscribeProfile(user.uid, (p) => {
      setProfile(p);
      setLoadingProfile(false);
    });
    const unsubW = subscribeWorkplaces(user.uid, setWorkplaces);
    return () => {
      unsubP();
      unsubW();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingEntries(true);
    const from = startOfMonth(viewMonth).getTime();
    const to = endOfMonth(viewMonth).getTime();
    const unsub = subscribeEntriesInRange(user.uid, from, to, (list) => {
      setEntries(list);
      setLoadingEntries(false);
    });
    return unsub;
  }, [user, viewMonth]);

  const value = useMemo<AppData>(
    () => ({
      profile,
      workplaces,
      entries,
      loading: loadingProfile || loadingEntries,
      viewMonth,
      setViewMonth,
    }),
    [profile, workplaces, entries, loadingProfile, loadingEntries, viewMonth],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData deve estar dentro de <AppDataProvider>");
  return v;
}