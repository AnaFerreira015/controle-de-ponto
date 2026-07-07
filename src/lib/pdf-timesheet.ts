import { PDFDocument, StandardFonts } from "pdf-lib";
import type { TimeEntry, EntryType } from "@/lib/types";
import { ymd } from "@/lib/time-utils";

// Coordenadas mapeadas a partir do template original (A4, 595.27 x 841.89 pt).
// Tabela "ANOTAÇÕES DIÁRIAS DA JORNADA DE TRABALHO":
//   - Primeira linha de dado (dia 01): topo em y=259.886
//   - Última linha de dado (dia 31): base em y=651.566
//   - 31 linhas => altura por linha ≈ 12.635 pt
// Colunas de horário (X central):
//   - Entrada:        (57.9  + 109.14) / 2 = 83.52
//   - Saída almoço:   (160.38 + 211.56) / 2 = 185.97
//   - Volta almoço:   (262.8  + 314.04) / 2 = 288.42
//   - Saída:          (365.28 + 416.52) / 2 = 390.90
const PAGE_HEIGHT = 841.886;
const FIRST_ROW_TOP = 259.886;
const ROW_HEIGHT = 12.635;
const FONT_SIZE = 9;
const COLUMN_X_CENTER: Record<Exclude<EntryType, "pausa" | "volta_pausa">, number> = {
  entrada: 83.52,
  saida_almoco: 185.97,
  volta_almoco: 288.42,
  saida: 390.9,
};

function formatHHMM(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function groupByDay(entries: TimeEntry[]): Map<string, TimeEntry[]> {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    if (e.isDeleted) continue;
    const key = ymd(new Date(e.entryDatetime));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

/**
 * Pega o primeiro registro de cada tipo no dia (menor entryDatetime).
 * Útil quando o usuário bateu ponto múltiplas vezes por engano.
 */
function firstOfType(list: TimeEntry[], type: EntryType): TimeEntry | undefined {
  return list
    .filter((e) => e.entryType === type)
    .sort((a, b) => a.entryDatetime - b.entryDatetime)[0];
}

export interface FillTimesheetOptions {
  templateBytes: ArrayBuffer;
  entries: TimeEntry[];
  /** Mês/ano referente à folha (usa year/month da Date, dia é ignorado). */
  month: Date;
}

export async function fillTimesheetPdf({
  templateBytes,
  entries,
  month,
}: FillTimesheetOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const page = pdf.getPages()[0];
  if (!page) throw new Error("O PDF não contém páginas.");
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const byDay = groupByDay(entries);

  const pageHeight = page.getHeight() || PAGE_HEIGHT;

  for (let day = 1; day <= daysInMonth; day++) {
    const key = ymd(new Date(year, monthIndex, day));
    const dayEntries = byDay.get(key);
    if (!dayEntries?.length) continue;

    const rowIndex = day - 1;
    // Baseline vertical: topo da linha + ~font size para centralizar visualmente.
    const yFromTop = FIRST_ROW_TOP + rowIndex * ROW_HEIGHT + FONT_SIZE;
    const y = pageHeight - yFromTop;

    (Object.keys(COLUMN_X_CENTER) as (keyof typeof COLUMN_X_CENTER)[]).forEach((type) => {
      const entry = firstOfType(dayEntries, type);
      if (!entry) return;
      const text = formatHHMM(entry.entryDatetime);
      const width = font.widthOfTextAtSize(text, FONT_SIZE);
      const x = COLUMN_X_CENTER[type] - width / 2;
      page.drawText(text, { x, y, size: FONT_SIZE, font });
    });
  }

  return pdf.save();
}
