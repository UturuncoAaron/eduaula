// Convierte la disponibilidad declarada + las citas ocupadas en `WeekSlot[]`
// para alimentar el componente <app-week-grid>.
//
// A diferencia de `booking-slots.ts` (que generaba un slot pequeño por cada
// step del paso), aquí emitimos UN bloque por cada rango contiguo de
// disponibilidad — el render queda como una franja verde continua sin
// gaps, igual look que el editor de horario admin (pixel-perfect).
//
// Los slots ocupados se emiten en otro bloque (gris) para que queden
// renderizados encima del verde.

import {
  AccountAvailability,
  SlotTaken,
} from '../../core/models/appointments';
import {
  WeekDia,
  WeekSlot,
  addDays,
  toHHMM,
  toMin,
} from '../components/week-grid/week-grid.types';

export interface BuildWeekBookingArgs {
  availability: readonly AccountAvailability[];
  taken: readonly SlotTaken[];
  /** Lunes de la semana visible (YYYY-MM-DD). Usado para mapear citas reales al día. */
  weekStart: string;
  /** Días permitidos para esta regla (filtra el resultado). */
  allowedDays?: readonly string[] | null;
}

export function buildWeekBookingSlots(args: BuildWeekBookingArgs): WeekSlot[] {
  const allowFilter = args.allowedDays && args.allowedDays.length > 0
    ? new Set(args.allowedDays)
    : null;

  const result: WeekSlot[] = [];

  // 1) bloques de disponibilidad por día — uno por rango contiguo.
  const byDay = new Map<WeekDia, AccountAvailability[]>();
  for (const av of args.availability) {
    if (!av.activo) continue;
    if (allowFilter && !allowFilter.has(av.diaSemana)) continue;
    if (!isWeekDia(av.diaSemana)) continue;
    const list = byDay.get(av.diaSemana) ?? [];
    list.push(av);
    byDay.set(av.diaSemana, list);
  }

  for (const [dia, list] of byDay) {
    const ranges = list
      .map(a => ({ s: toMin(a.horaInicio), e: toMin(a.horaFin), id: a.id }))
      .sort((a, b) => a.s - b.s);

    // Mergear contiguos / solapados.
    const merged: { s: number; e: number; ids: string[] }[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.s <= last.e) {
        last.e = Math.max(last.e, r.e);
        last.ids.push(String(r.id));
      } else {
        merged.push({ s: r.s, e: r.e, ids: [String(r.id)] });
      }
    }

    for (const m of merged) {
      result.push({
        id: `av-${dia}-${m.s}-${m.e}`,
        dia,
        horaInicio: toHHMM(m.s),
        horaFin: toHHMM(m.e),
        title: 'Disponible',
        kind: 'available',
      });
    }
  }

  // 2) Slots ocupados — uno por cita.
  const wsStart = parseDate(args.weekStart);
  const wsEnd = parseDate(addDays(args.weekStart, 7));
  for (const t of args.taken) {
    const d = new Date(t.scheduledAt);
    if (d < wsStart || d >= wsEnd) continue;
    const diaKey = dayIdxToKey(d.getDay());
    if (!diaKey) continue;
    if (allowFilter && !allowFilter.has(diaKey)) continue;

    const startMin = d.getHours() * 60 + d.getMinutes();
    const dur = t.durationMin ?? 30;
    result.push({
      id: `taken-${t.id}`,
      dia: diaKey,
      horaInicio: toHHMM(startMin),
      horaFin: toHHMM(startMin + dur),
      title: 'Ocupado',
      kind: 'taken',
    });
  }

  return result;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dayIdxToKey(idx: number): WeekDia | null {
  switch (idx) {
    case 1: return 'lunes';
    case 2: return 'martes';
    case 3: return 'miercoles';
    case 4: return 'jueves';
    case 5: return 'viernes';
    case 6: return 'sabado';
    default: return null;
  }
}

function isWeekDia(s: string): s is WeekDia {
  return (
    s === 'lunes' ||
    s === 'martes' ||
    s === 'miercoles' ||
    s === 'jueves' ||
    s === 'viernes' ||
    s === 'sabado'
  );
}
