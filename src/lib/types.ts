export type EntryType =
  | "entrada"
  | "saida_almoco"
  | "volta_almoco"
  | "pausa"
  | "volta_pausa"
  | "saida";

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída p/ almoço",
  volta_almoco: "Volta do almoço",
  pausa: "Pausa",
  volta_pausa: "Volta da pausa",
  saida: "Saída",
};

export interface UserProfile {
  name: string;
  email: string;
  mainWorkplaceId: string | null;
  dailyExpectedHours: number; // horas esperadas por dia
  dataRetentionMonths: number;
  createdAt: number;
  updatedAt: number;
}

export interface Workplace {
  id: string;
  name: string;
  description: string;
  active: boolean;
  isDeleted?: boolean;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface TimeEntry {
  id: string;
  workplaceId: string;
  entryType: EntryType;
  entryDatetime: number; // ms epoch
  originalEntryDatetime: number;
  notes: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TimeEntryLog {
  id: string;
  timeEntryId: string;
  actionType: "create" | "edit" | "delete";
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  createdAt: number;
}

export interface DataCleanupLog {
  id: string;
  deletedFromDate: number;
  deletedUntilDate: number;
  affectedRecordsCount: number;
  cleanupType: string;
  createdAt: number;
}