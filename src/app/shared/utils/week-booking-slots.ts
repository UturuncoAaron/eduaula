import {
  AccountAvailability,
  AppointmentEstado,
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
  /** Lunes de la semana visible (YYYY-MM-DD). */
  weekStart: string;
  /** Días permitidos por la regla (filtra el resultado). */
  allowedDays?: readonly string[] | null;
}

// Paleta de estados ocupados.
const TAKEN_STYLES: Record<AppointmentEstado, { title: string; color: string }> = {
  pendiente: { title: 'Pendiente', color: '#fde68a' }, // ámbar suave
  confirmada: { title: 'Ocupado', color: '#fecaca' }, // rojo suave
  realizada: { title: 'Realizada', color: '#d1d5db' }, // gris
  cancelada: { title: 'Cancelada', color: '#e5e7eb' }, // gris claro
  rechazada: { title: 'Rechazada', color: '#e5e7eb' },
  no_asistio: { title: 'No asistió', color: '#e5e7eb' },
};

export function buildWeekBookingSlots(args: BuildWeekBookingArgs): WeekSlot[] {
  const allowFilter = args.allowedDays && args.allowedDays.length > 0
    ? new Set(args.allowedDays)
    : null;

  const result: WeekSlot[] = [];

  // 1) Disponibilidad: un bloque por rango contiguo y mergeado.
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
      .map(a => ({ s: toMin(a.horaInicio), e: toMin(a.horaFin) }))
      .sort((a, b) => a.s - b.s);

    const merged: { s: number; e: number }[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.s <= last.e) {
        last.e = Math.max(last.e, r.e);
      } else {
        merged.push({ s: r.s, e: r.e });
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

  // 2) Ocupados: un slot por cita activa, con color según estado.
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
    const style = TAKEN_STYLES[t.estado] ?? TAKEN_STYLES.confirmada;

    result.push({
      id: `taken-${t.id}`,
      dia: diaKey,
      horaInicio: toHHMM(startMin),
      horaFin: toHHMM(startMin + dur),
      title: style.title,
      subtitle: `${toHHMM(startMin)} – ${toHHMM(startMin + dur)}`,
      kind: 'taken',
      color: style.color,
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
  return s === 'lunes' || s === 'martes' || s === 'miercoles'
    || s === 'jueves' || s === 'viernes' || s === 'sabado';
}