import type { EntryType, TimeEntry, UserProfile } from "@/lib/types";
import { isWeekend, startOfDay, ymd } from "@/lib/time-utils";

type GeneratedType = Extract<EntryType, "entrada" | "saida_almoco" | "volta_almoco" | "saida">;

const TYPES: GeneratedType[] = ["entrada", "saida_almoco", "volta_almoco", "saida"];

const OFFSETS: Record<GeneratedType, number[]> = {
  entrada: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5],
  saida_almoco: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5],
  volta_almoco: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5],
  saida: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
};

function parseClock(value: string): [number, number] {
  const [h, m] = value.split(":").map((x) => parseInt(x, 10));
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(list: T[]): T {
  return list[randomInt(0, list.length - 1)];
}

function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isRoundTime(ts: number): boolean {
  const minutes = new Date(ts).getMinutes();
  return minutes % 30 === 0;
}

interface Usage {
  counts: Map<string, number>;
  last: Map<GeneratedType, string[]>;
  usedRoundRecently: boolean;
}

const COOLDOWN_DAYS = 4;

function keyOf(type: GeneratedType, ts: number): string {
  return `${type}@${hhmm(ts)}`;
}

interface DayPlan {
  date: Date;
  times: Record<GeneratedType, number>;
  fixedTypes: Set<GeneratedType>;
  extraMinutes: number;
}

function buildDay(
  date: Date,
  bases: Record<GeneratedType, number>,
  baseWorkedMinutes: number,
  usage: Usage,
  maxRepeats: number,
  saidaTarget: number,
  fixed: Partial<Record<GeneratedType, number>> = {},
): DayPlan {
  const times = {} as Record<GeneratedType, number>;
  const usedOffsets = new Set<number>();
  const fixedTypes = new Set<GeneratedType>();

  for (const type of TYPES) {
    const recent = usage.last.get(type) ?? [];

    const fixedTs = fixed[type];
    if (fixedTs !== undefined) {
      times[type] = fixedTs;
      fixedTypes.add(type);
      usage.counts.set(keyOf(type, fixedTs), (usage.counts.get(keyOf(type, fixedTs)) ?? 0) + 1);
      usage.last.set(type, [...recent, hhmm(fixedTs)].slice(-COOLDOWN_DAYS));
      continue;
    }

    let candidates = OFFSETS[type]
      .map((offset) => {
        const ts = bases[type] + offset * 60000;
        return { offset, ts, label: hhmm(ts), count: usage.counts.get(keyOf(type, ts)) ?? 0 };
      })
      .filter((c) => !isRoundTime(c.ts));

    if (type === "saida") {
      const near = candidates.filter((c) => Math.abs(c.offset - saidaTarget) <= 3);
      if (near.length > 0) candidates = near;
    }

    const filters: ((c: (typeof candidates)[number]) => boolean)[] = [
      (c) => !recent.includes(c.label) && c.count < maxRepeats && !usedOffsets.has(c.offset),
      (c) => !recent.includes(c.label) && c.count < maxRepeats,
      (c) => !recent.includes(c.label),
      () => true,
    ];

    let pool = candidates;
    for (const filter of filters) {
      const filtered = candidates.filter(filter);
      if (filtered.length > 0) {
        pool = filtered;
        break;
      }
    }

    const minCount = Math.min(...pool.map((c) => c.count));
    const leastUsed = pool.filter((c) => c.count === minCount);
    const picked = pick(leastUsed);

    const seconds = type === "saida" ? randomInt(0, 55) : randomInt(0, 59);
    const ts = picked.ts + seconds * 1000;

    times[type] = ts;
    usedOffsets.add(picked.offset);
    usage.counts.set(keyOf(type, ts), (usage.counts.get(keyOf(type, ts)) ?? 0) + 1);
    usage.last.set(type, [...recent, hhmm(ts)].slice(-COOLDOWN_DAYS));
  }

  const worked = (times.saida_almoco - times.entrada + (times.saida - times.volta_almoco)) / 60000;

  return { date, times, fixedTypes, extraMinutes: Math.round(worked - baseWorkedMinutes) };
}

function cloneUsage(u: Usage): Usage {
  return {
    counts: new Map(u.counts),
    last: new Map([...u.last].map(([k, v]) => [k, [...v]] as const)),
    usedRoundRecently: u.usedRoundRecently,
  };
}

function makeEntry(
  date: Date,
  type: GeneratedType,
  ts: number,
  workplaceId: string,
  index: number,
): TimeEntry {
  return {
    id: `random-${date.getTime()}-${index}`,
    workplaceId,
    entryType: type,
    entryDatetime: ts,
    originalEntryDatetime: ts,
    notes: "",
    isEdited: false,
    isDeleted: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

export interface GenerateRandomEntriesOptions {
  profile: UserProfile | null | undefined;
  month: Date;
  workplaceId?: string;
  until?: Date;
  existingEntries?: TimeEntry[];
}

export function generateRandomEntries({
  profile,
  month,
  workplaceId = "",
  until = new Date(),
  existingEntries = [],
}: GenerateRandomEntriesOptions): TimeEntry[] {
  if (!profile) {
    throw new Error("Você precisa estar logado para usar esta função.");
  }

  const missing: string[] = [];
  if (!profile.workStartTime) missing.push("horário de entrada");
  if (!profile.lunchStartTime) missing.push("horário de saída para o almoço");
  if (!profile.lunchEndTime) missing.push("horário de volta do almoço");

  const hasEndTime = Boolean(profile.workEndTime);
  const hasDailyHours =
    Number.isFinite(profile.dailyExpectedHours) && profile.dailyExpectedHours > 0;
  if (!hasEndTime && !hasDailyHours) {
    missing.push("horário de saída (ou carga horária diária)");
  }

  if (missing.length > 0) {
    throw new Error(
      `Configure seu expediente em "Ajustes" antes de gerar a folha aleatória. Faltando: ${missing.join(", ")}.`,
    );
  }

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const limit = startOfDay(until).getTime();

  const realByDay = new Map<string, Partial<Record<GeneratedType, TimeEntry>>>();
  for (const entry of existingEntries) {
    if (entry.isDeleted) continue;
    const type = entry.entryType as GeneratedType;
    if (!TYPES.includes(type)) continue;
    const d = new Date(entry.entryDatetime);
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
    const key = ymd(d);
    const day = realByDay.get(key) ?? {};
    const current = day[type];
    if (!current || entry.entryDatetime < current.entryDatetime) day[type] = entry;
    realByDay.set(key, day);
  }

  function profileMinutes(profileValue: string): number {
    const [h, m] = parseClock(profileValue);
    return h * 60 + m;
  }

  const workStartTime = profile.workStartTime;
  const lunchStartTime = profile.lunchStartTime;
  const lunchEndTime = profile.lunchEndTime;
  if (!workStartTime || !lunchStartTime || !lunchEndTime) {
    throw new Error('Configure todos os horários do expediente em "Ajustes".');
  }

  const baseStartMin = profileMinutes(workStartTime);
  const baseLunchStartMin = profileMinutes(lunchStartTime);
  const baseLunchEndMin = profileMinutes(lunchEndTime);
  const expectedWorkMinutes = Math.round(profile.dailyExpectedHours * 60);
  const lunchMinutes = baseLunchEndMin - baseLunchStartMin;
  const configuredEndMin = profile.workEndTime ? profileMinutes(profile.workEndTime) : null;
  const configuredWorkMinutes =
    configuredEndMin === null
      ? null
      : baseLunchStartMin - baseStartMin + configuredEndMin - baseLunchEndMin;

  const baseEndMin =
    configuredEndMin !== null &&
    configuredWorkMinutes !== null &&
    Math.abs(configuredWorkMinutes - expectedWorkMinutes) <= 30
      ? configuredEndMin
      : baseStartMin + expectedWorkMinutes + lunchMinutes;

  const atMinutes = (date: Date, minutes: number): number => {
    const d = startOfDay(date);
    d.setMinutes(minutes);
    return d.getTime();
  };

  const weeks: Date[][] = [];
  let currentWeekKey = -1;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const hasReal = realByDay.has(ymd(date));
    if (isWeekend(date) && !hasReal) continue;
    if (startOfDay(date).getTime() > limit && !hasReal) continue;
    const monday = startOfDay(date);
    monday.setDate(monday.getDate() - ((date.getDay() + 6) % 7));
    const key = monday.getTime();
    if (key !== currentWeekKey) {
      weeks.push([]);
      currentWeekKey = key;
    }
    weeks[weeks.length - 1].push(date);
  }

  const usedWeekTotals = new Set<number>();
  let usage: Usage = { counts: new Map(), last: new Map(), usedRoundRecently: false };
  const entries: TimeEntry[] = [];

  const totalWorkDays = weeks.reduce((sum, w) => sum + w.length, 0) || 1;
  const monthTargetExtra = randomInt(40, 190);
  const perDayTarget = Math.min(18, Math.max(3, monthTargetExtra / totalWorkDays));

  for (const weekDays of weeks) {
    const maxRepeats = 3;
    const weekTarget = Math.round(perDayTarget * weekDays.length) + randomInt(-4, 4);

    let best: { plans: DayPlan[]; usage: Usage; total: number } | null = null;

    for (let attempt = 0; attempt < 80; attempt++) {
      const attemptUsage = cloneUsage(usage);
      const plans: DayPlan[] = [];

      for (const date of weekDays) {
        const start = atMinutes(date, baseStartMin);
        const lunchStart = atMinutes(date, baseLunchStartMin);
        const lunchEnd = atMinutes(date, baseLunchEndMin);
        const end = atMinutes(date, baseEndMin);
        attemptUsage.usedRoundRecently = false;
        const saidaTarget = Math.min(20, Math.max(2, Math.round(perDayTarget) + randomInt(-3, 3)));
        const realDay = realByDay.get(ymd(date)) ?? {};
        const fixed: Partial<Record<GeneratedType, number>> = {};
        for (const type of TYPES) {
          const real = realDay[type];
          if (real) fixed[type] = real.entryDatetime;
        }
        plans.push(
          buildDay(
            date,
            { entrada: start, saida_almoco: lunchStart, volta_almoco: lunchEnd, saida: end },
            expectedWorkMinutes,
            attemptUsage,
            maxRepeats,
            saidaTarget,
            fixed,
          ),
        );
      }

      const total = plans.reduce((sum, p) => sum + p.extraMinutes, 0);
      const valid = Math.abs(total - weekTarget) <= 5 && !usedWeekTotals.has(total);
      if (valid) {
        best = { plans, usage: attemptUsage, total };
        break;
      }
      if (!best || Math.abs(total - weekTarget) < Math.abs(best.total - weekTarget)) {
        best = { plans, usage: attemptUsage, total };
      }
    }

    if (!best) continue;
    usedWeekTotals.add(best.total);
    usage = best.usage;

    for (const plan of best.plans) {
      const realDay = realByDay.get(ymd(plan.date)) ?? {};
      let previous = -Infinity;
      TYPES.forEach((type, index) => {
        const real = realDay[type];
        if (real) {
          previous = Math.max(previous, real.entryDatetime);
          entries.push(real);
          return;
        }
        let ts = plan.times[type];
        if (ts <= previous) ts = previous + randomInt(60, 180) * 1000;
        previous = ts;
        entries.push(makeEntry(plan.date, type, ts, workplaceId, index));
      });
    }
  }

  return entries.sort((a, b) => a.entryDatetime - b.entryDatetime);
}
