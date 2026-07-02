import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  subscribeEntryMonths,
  subscribeEntriesInRange,
  subscribeProfile,
  subscribeWorkplaces,
} from "./firestore-service";
import { startOfMonth, endOfMonth, ym } from "./time-utils";
import type { TimeEntry, UserProfile, Workplace } from "./types";
import { useAuth } from "./auth-context";

interface AppData {
  profile: UserProfile | null;
  workplaces: Workplace[];
  entries: TimeEntry[]; // current month + previous/next month window? for now: current month
  entryMonthKeys: string[];
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
  const [entryMonthKeys, setEntryMonthKeys] = useState<string[]>([]);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingMonths, setLoadingMonths] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubP = subscribeProfile(user.uid, (p) => {
      setProfile(p);
      setLoadingProfile(false);
    });
    const unsubW = subscribeWorkplaces(user.uid, setWorkplaces);
    const unsubM = subscribeEntryMonths(user.uid, (months) => {
      setEntryMonthKeys(months);
      setLoadingMonths(false);
    });
    return () => {
      unsubP();
      unsubW();
      unsubM();
    };
  }, [user]);

  useEffect(() => {
    if (loadingMonths) return;
    const currentMonthKey = ym(new Date());
    const viewedMonthKey = ym(viewMonth);

    if (entryMonthKeys.length === 0 && viewedMonthKey !== currentMonthKey) {
      setViewMonth(new Date());
      return;
    }

    if (
      entryMonthKeys.length > 0 &&
      viewedMonthKey !== currentMonthKey &&
      !entryMonthKeys.includes(viewedMonthKey)
    ) {
      setViewMonth(new Date());
    }
  }, [entryMonthKeys, loadingMonths, viewMonth]);

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
      entryMonthKeys,
      loading: loadingProfile || loadingEntries || loadingMonths,
      viewMonth,
      setViewMonth,
    }),
    [profile, workplaces, entries, entryMonthKeys, loadingProfile, loadingEntries, loadingMonths, viewMonth],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData deve estar dentro de <AppDataProvider>");
  return v;
}