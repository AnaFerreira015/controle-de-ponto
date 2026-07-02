import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { sanitizeDisplayName, looksLikeEmail } from "./user-display";
import type {
  DataCleanupLog,
  EntryType,
  TimeEntry,
  TimeEntryLog,
  UserProfile,
  Workplace,
} from "./types";

const DEFAULT_PROFILE_SETTINGS = {
  dailyExpectedHours: 8,
  dataRetentionMonths: 12,
  workStartTime: "08:00",
  lunchStartTime: "12:00",
  lunchEndTime: "13:00",
  workEndTime: "17:00",
  notificationsEnabled: false,
  notificationLeadMinutes: 0,
  pushNotificationsEnabled: false,
};

function monthKeyFromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ----- User profile -----
export async function getOrCreateProfile(
  uid: string,
  email: string,
  name: string,
): Promise<UserProfile> {
  const ref = doc(getDb(), "users", uid);
  const snap = await getDoc(ref);
  const cleanedName = sanitizeDisplayName(name);
  const now = Date.now();
  if (snap.exists()) {
    const profile = snap.data() as UserProfile;
    const patch: Partial<UserProfile> = {};

    if (cleanedName && (!profile.name || looksLikeEmail(profile.name))) {
      patch.name = cleanedName;
    }
    if (profile.dailyExpectedHours === undefined) patch.dailyExpectedHours = DEFAULT_PROFILE_SETTINGS.dailyExpectedHours;
    if (profile.dataRetentionMonths === undefined) patch.dataRetentionMonths = DEFAULT_PROFILE_SETTINGS.dataRetentionMonths;
    if (!profile.workStartTime) patch.workStartTime = DEFAULT_PROFILE_SETTINGS.workStartTime;
    if (!profile.lunchStartTime) patch.lunchStartTime = DEFAULT_PROFILE_SETTINGS.lunchStartTime;
    if (!profile.lunchEndTime) patch.lunchEndTime = DEFAULT_PROFILE_SETTINGS.lunchEndTime;
    if (!profile.workEndTime) patch.workEndTime = DEFAULT_PROFILE_SETTINGS.workEndTime;
    if (profile.notificationsEnabled === undefined) patch.notificationsEnabled = DEFAULT_PROFILE_SETTINGS.notificationsEnabled;
    if (profile.notificationLeadMinutes === undefined) patch.notificationLeadMinutes = DEFAULT_PROFILE_SETTINGS.notificationLeadMinutes;
    if (profile.pushNotificationsEnabled === undefined) patch.pushNotificationsEnabled = DEFAULT_PROFILE_SETTINGS.pushNotificationsEnabled;

    if (Object.keys(patch).length) {
      const updatedProfile = { ...profile, ...patch, updatedAt: now };
      await updateDoc(ref, { ...patch, updatedAt: now });
      return updatedProfile;
    }
    return profile;
  }
  const profile: UserProfile = {
    name: cleanedName,
    email,
    mainWorkplaceId: null,
    ...DEFAULT_PROFILE_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, profile);
  return profile;
}

export async function updateProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  const ref = doc(getDb(), "users", uid);
  await updateDoc(ref, { ...patch, updatedAt: Date.now() });
}

export function subscribeProfile(
  uid: string,
  cb: (p: UserProfile | null) => void,
): Unsubscribe {
  return onSnapshot(doc(getDb(), "users", uid), (snap) => {
    cb(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}

// ----- Workplaces -----
export function subscribeWorkplaces(
  uid: string,
  cb: (list: Workplace[]) => void,
): Unsubscribe {
  const col = collection(getDb(), "users", uid, "workplaces");
  return onSnapshot(query(col, orderBy("createdAt", "asc")), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workplace, "id">) })));
  });
}

export async function createWorkplace(
  uid: string,
  data: { name: string; description: string },
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collection(getDb(), "users", uid, "workplaces"), {
    name: data.name,
    description: data.description,
    active: true,
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateWorkplace(
  uid: string,
  id: string,
  patch: Partial<Omit<Workplace, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid, "workplaces", id), {
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function deleteWorkplace(uid: string, id: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const profileRef = doc(db, "users", uid);
  const workplaceRef = doc(db, "users", uid, "workplaces", id);
  const profileSnap = await getDoc(profileRef);
  const batch = writeBatch(db);

  batch.update(workplaceRef, {
    active: false,
    isDeleted: true,
    deletedAt: now,
    updatedAt: now,
  });

  if (profileSnap.exists() && (profileSnap.data() as UserProfile).mainWorkplaceId === id) {
    batch.update(profileRef, {
      mainWorkplaceId: null,
      updatedAt: now,
    });
  }

  await batch.commit();
}

// ----- Time entries -----
export function subscribeEntriesInRange(
  uid: string,
  fromMs: number,
  toMs: number,
  cb: (list: TimeEntry[]) => void,
): Unsubscribe {
  const col = collection(getDb(), "users", uid, "timeEntries");
  const q = query(
    col,
    where("entryDatetime", ">=", fromMs),
    where("entryDatetime", "<=", toMs),
    orderBy("entryDatetime", "asc"),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TimeEntry, "id">) })));
  });
}

export function subscribeEntryMonths(
  uid: string,
  cb: (monthKeys: string[]) => void,
): Unsubscribe {
  const col = collection(getDb(), "users", uid, "timeEntries");
  return onSnapshot(query(col, orderBy("entryDatetime", "asc")), (snap) => {
    const months = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data() as Omit<TimeEntry, "id">;
      if (!data.isDeleted && Number.isFinite(data.entryDatetime)) {
        months.add(monthKeyFromMs(data.entryDatetime));
      }
    });
    cb(Array.from(months).sort());
  });
}

export async function createTimeEntry(
  uid: string,
  data: {
    workplaceId: string;
    entryType: EntryType;
    entryDatetime: number;
    notes: string;
    delayReason?: string;
  },
): Promise<string> {
  const now = Date.now();
  const createdWithDelay = Math.abs(now - data.entryDatetime) > 60_000;
  const payload = {
    workplaceId: data.workplaceId,
    entryType: data.entryType,
    entryDatetime: data.entryDatetime,
    originalEntryDatetime: data.entryDatetime,
    notes: data.notes ?? "",
    isEdited: false,
    isDeleted: false,
    createdWithDelay,
    delayReason: data.delayReason ?? "",
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(getDb(), "users", uid, "timeEntries"), payload);
  await addLog(uid, {
    timeEntryId: ref.id,
    actionType: "create",
    fieldName: "entryDatetime",
    oldValue: "",
    newValue: String(data.entryDatetime),
    reason: data.delayReason || (createdWithDelay ? "Registro feito com atraso" : "Registro inicial"),
  });
  return ref.id;
}

export async function editTimeEntry(
  uid: string,
  entry: TimeEntry,
  patch: { entryDatetime?: number; notes?: string; entryType?: EntryType },
  reason: string,
): Promise<void> {
  const now = Date.now();
  const updates: Record<string, unknown> = {
    isEdited: true,
    updatedAt: now,
  };
  if (patch.entryDatetime !== undefined && patch.entryDatetime !== entry.entryDatetime) {
    updates.entryDatetime = patch.entryDatetime;
    await addLog(uid, {
      timeEntryId: entry.id,
      actionType: "edit",
      fieldName: "entryDatetime",
      oldValue: String(entry.entryDatetime),
      newValue: String(patch.entryDatetime),
      reason,
    });
  }
  if (patch.notes !== undefined && patch.notes !== entry.notes) {
    updates.notes = patch.notes;
    await addLog(uid, {
      timeEntryId: entry.id,
      actionType: "edit",
      fieldName: "notes",
      oldValue: entry.notes,
      newValue: patch.notes,
      reason,
    });
  }
  if (patch.entryType !== undefined && patch.entryType !== entry.entryType) {
    updates.entryType = patch.entryType;
    await addLog(uid, {
      timeEntryId: entry.id,
      actionType: "edit",
      fieldName: "entryType",
      oldValue: entry.entryType,
      newValue: patch.entryType,
      reason,
    });
  }
  await updateDoc(doc(getDb(), "users", uid, "timeEntries", entry.id), updates);
}

export async function softDeleteEntry(
  uid: string,
  entry: TimeEntry,
  reason: string,
): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid, "timeEntries", entry.id), {
    isDeleted: true,
    updatedAt: Date.now(),
  });
  await addLog(uid, {
    timeEntryId: entry.id,
    actionType: "delete",
    fieldName: "isDeleted",
    oldValue: "false",
    newValue: "true",
    reason,
  });
}

async function addLog(uid: string, data: Omit<TimeEntryLog, "id" | "createdAt">): Promise<void> {
  await addDoc(collection(getDb(), "users", uid, "timeEntryLogs"), {
    ...data,
    createdAt: Date.now(),
  });
}

// ----- Push notification tokens -----
function tokenDocId(token: string): string {
  return encodeURIComponent(token).replaceAll(".", "%2E");
}

export async function saveNotificationToken(
  uid: string,
  token: string,
  data: { userAgent: string },
): Promise<void> {
  const now = Date.now();
  await setDoc(doc(getDb(), "users", uid, "notificationTokens", tokenDocId(token)), {
    token,
    platform: "web",
    userAgent: data.userAgent,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  }, { merge: true });
}

export async function disableNotificationToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(getDb(), "users", uid, "notificationTokens", tokenDocId(token)), {
    enabled: false,
    updatedAt: Date.now(),
  }, { merge: true });
}

// ----- Cleanup -----
export async function cleanupEntriesBefore(
  uid: string,
  beforeMs: number,
): Promise<number> {
  const col = collection(getDb(), "users", uid, "timeEntries");
  const snap = await getDocs(query(col, where("entryDatetime", "<", beforeMs)));
  const batch = writeBatch(getDb());
  const now = Date.now();
  let count = 0;
  snap.forEach((d) => {
    const data = d.data() as TimeEntry;
    if (!data.isDeleted) {
      batch.update(d.ref, { isDeleted: true, updatedAt: now });
      count++;
    }
  });
  await batch.commit();
  await addDoc(collection(getDb(), "users", uid, "dataCleanupLogs"), {
    deletedFromDate: 0,
    deletedUntilDate: beforeMs,
    affectedRecordsCount: count,
    cleanupType: "manual",
    createdAt: now,
  } satisfies Omit<DataCleanupLog, "id">);
  return count;
}