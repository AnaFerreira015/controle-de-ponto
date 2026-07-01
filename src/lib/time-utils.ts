import type { EntryType, TimeEntry } from "./types";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMinutes(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Given the last entry type of the day, suggest the next.
 * If null (no entries yet), suggest "entrada".
 */
export function suggestNextType(lastType: EntryType | null): EntryType {
  switch (lastType) {
    case null:
      return "entrada";
    case "entrada":
      return "saida_almoco";
    case "saida_almoco":
      return "volta_almoco";
    case "volta_almoco":
      return "saida";
    case "pausa":
      return "volta_pausa";
    case "volta_pausa":
      return "saida";
    case "saida":
      return "entrada";
  }
}

/**
 * Check if the transition from last -> next is consistent.
 * Returns null if OK, otherwise a warning message.
 */
export function checkConsistency(
  lastType: EntryType | null,
  next: EntryType,
): string | null {
  if (next === "entrada" && lastType && lastType !== "saida") {
    return "Você já tem um expediente em aberto. Registrar 'Entrada' de novo?";
  }
  if (next === "saida" && !lastType) {
    return "Não há entrada registrada hoje. Registrar saída mesmo assim?";
  }
  if (next === "volta_almoco" && lastType !== "saida_almoco") {
    return "Não há 'Saída para almoço' anterior. Registrar mesmo assim?";
  }
  if (next === "volta_pausa" && lastType !== "pausa") {
    return "Não há 'Pausa' anterior. Registrar mesmo assim?";
  }
  if (next === "saida_almoco" && lastType !== "entrada" && lastType !== "volta_pausa") {
    return "Sem 'Entrada' anterior. Registrar saída para almoço mesmo assim?";
  }
  return null;
}

/**
 * Sort entries by datetime asc, excluding deleted.
 */
function activeEntries(entries: TimeEntry[]): TimeEntry[] {
  return entries
    .filter((e) => !e.isDeleted)
    .sort((a, b) => a.entryDatetime - b.entryDatetime);
}

/**
 * Calculate worked minutes given entries of a day.
 * Pairs: entrada→(saida_almoco|pausa|saida). volta_almoco/volta_pausa→(saida_almoco|pausa|saida).
 * If day is open (last is a "working start"), uses `now`.
 */
export function calculateWorkedMinutes(
  entries: TimeEntry[],
  now: number = Date.now(),
): { minutes: number; isOpen: boolean } {
  const list = activeEntries(entries);
  let total = 0;
  let openStart: number | null = null;
  const workStarts: EntryType[] = ["entrada", "volta_almoco", "volta_pausa"];
  const workEnds: EntryType[] = ["saida_almoco", "pausa", "saida"];

  for (const e of list) {
    if (workStarts.includes(e.entryType)) {
      if (openStart === null) openStart = e.entryDatetime;
    } else if (workEnds.includes(e.entryType)) {
      if (openStart !== null) {
        total += (e.entryDatetime - openStart) / 60000;
        openStart = null;
      }
    }
  }
  let isOpen = false;
  if (openStart !== null) {
    total += (now - openStart) / 60000;
    isOpen = true;
  }
  return { minutes: Math.max(0, total), isOpen };
}

export function getLastEntryType(entries: TimeEntry[]): EntryType | null {
  const list = activeEntries(entries);
  return list.length ? list[list.length - 1].entryType : null;
}

export function entriesToCsv(entries: TimeEntry[], workplaceNames: Record<string, string>): string {
  const header = ["data", "hora", "tipo", "local", "editado", "observacao"];
  const rows = activeEntries(entries).map((e) => {
    const d = new Date(e.entryDatetime);
    return [
      d.toLocaleDateString("pt-BR"),
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      e.entryType,
      workplaceNames[e.workplaceId] ?? e.workplaceId,
      e.isEdited ? "sim" : "nao",
      (e.notes ?? "").replaceAll("\n", " ").replaceAll(";", ","),
    ].join(";");
  });
  return [header.join(";"), ...rows].join("\n");
}