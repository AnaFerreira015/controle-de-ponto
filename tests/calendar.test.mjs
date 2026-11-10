import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function moduleUrl(path, replacements = {}) {
  let source = readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const timeUrl = moduleUrl('../src/lib/time-utils.ts');
const time = await import(timeUrl);
const { generateRandomEntries } = await import(moduleUrl('../src/lib/random-timesheet.ts', { '@/lib/time-utils': timeUrl }));
const profile = { dailyExpectedHours: 8, workStartTime: '08:00', lunchStartTime: '12:00', lunchEndTime: '13:00', workEndTime: '17:00', notificationsEnabled: true };
const date = (s) => new Date(`${s}T18:00:00`);

for (const day of ['2026-01-01', '2026-04-03', '2026-04-21', '2026-05-01', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25', '2027-03-26', '2025-04-18', '2026-11-07', '2026-11-08']) {
  test(`dispensa pontos e lembretes em ${day}`, () => {
    const d = date(day);
    assert.deepEqual(time.getExpectedPoints(profile, d), []);
    assert.deepEqual(time.getMissingExpectedPoints(profile, [], d, d.getTime()), []);
    assert.equal(time.getDuePointReminder(profile, [], d.getTime()), null);
  });
}
test('mantém expediente nos dias úteis e pontos facultativos', () => {
  for (const day of ['2026-11-10', '2026-02-17', '2026-06-04', '2023-11-20', '2026-02-18']) {
    assert.equal(time.getExpectedPoints(profile, date(day)).length, 4);
  }
});
test('não gera pontos em feriados ou finais de semana', () => {
  const entries = generateRandomEntries({ profile, month: date('2026-11-01'), until: date('2026-11-30') });
  const days = [...new Set(entries.map(e => new Date(e.entryDatetime).getDate()))];
  assert.deepEqual(days, [3,4,5,6,9,10,11,12,13,16,17,18,19,23,24,25,26,27,30]);
  assert.equal(entries.length, 76);
});
test('preserva ponto real em dia dispensado sem inventar os restantes', () => {
  const real = { id: 'real', entryType: 'entrada', entryDatetime: date('2026-11-20').getTime(), isDeleted: false };
  const entries = generateRandomEntries({ profile, month: date('2026-11-01'), until: date('2026-11-30'), existingEntries: [real] });
  assert.deepEqual(entries.filter(e => new Date(e.entryDatetime).getDate() === 20), [real]);
});
test('zera carga prevista nos dias dispensados e mantém oito horas no dia útil', () => {
  for (const day of ['2026-11-20', '2026-11-07', '2026-11-08']) {
    assert.equal(time.getExpectedWorkMinutes(profile, date(day)), 0);
    assert.equal(time.getDayPointStatus(profile, [], date(day), date('2026-12-01').getTime()).variant, 'secondary');
  }
  assert.equal(time.getExpectedWorkMinutes(profile, date('2026-11-10')), 480);
  assert.equal(time.getDayPointStatus(profile, [], date('2026-11-10'), date('2026-12-01').getTime()).variant, 'destructive');
});
test('não gera pontos para completar registros de sábado e domingo', () => {
  const originals = [7, 8].map(day => ({ id: `real-${day}`, entryType: 'entrada', entryDatetime: new Date(2026, 10, day, 8).getTime(), isDeleted: false }));
  const entries = generateRandomEntries({ profile, month: date('2026-11-01'), until: date('2026-11-30'), existingEntries: originals });
  assert.deepEqual(entries.filter(e => [7,8].includes(new Date(e.entryDatetime).getDate())), originals);
});
