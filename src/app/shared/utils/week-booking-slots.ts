import {
  AccountAvailability,
  AppointmentEstado,
  DiaSemana,
  SlotTaken,
} from '../../core/models/appointments';
import { WeekSlot } from '../components/week-grid/week-grid.types';
import { CalendarSlot } from '../components/calendar-grid/calendar-grid.types';
import {
  addDaysDate,
  dayIdxToKey,
  formatHM,
  parseHM,
  parseLocalDate,
} from './calendar-week';

const DEFAULT_SLOT_MINUTES = 30;

// ── Helpers privados ──────────────────────────────────────────────

function titleForEstado(estado: AppointmentEstado): string {
  switch (estado) {
    case 'realizada': return 'Realizada';
    case 'no_asistio': return 'No asistió';
    default: return 'Ocupado';
  }
}

function weekRange(weekStart: string): { wsDate: Date; weDate: Date } {
  const wsDate = parseLocalDate(weekStart);
  return { wsDate, weDate: addDaysDate(wsDate, 7) };
}

// ── buildWeekBookingSlots ─────────────────────────────────────────
// Versión principal — devuelve WeekSlot[] para BookingCalendar.
// Los slots "realizados" y "no asistió" se muestran con título
// diferente al de "Ocupado" para que la psicóloga vea el historial.

export interface BuildWeekBookingSlotsParams {
  availability: AccountAvailability[];
  taken: SlotTaken[];
  weekStart: string;
  allowedDays?: readonly string[] | null;
  slotMinutes?: number;
}

export function buildWeekBookingSlots({
  availability,
  taken,
  weekStart,
  allowedDays,
  slotMinutes = DEFAULT_SLOT_MINUTES,
}: BuildWeekBookingSlotsParams): WeekSlot[] {
  const slots: WeekSlot[] = [];
  const index = new Map<string, number>();
  const step = slotMinutes > 0 ? slotMinutes : DEFAULT_SLOT_MINUTES;
  const dayFilter = allowedDays?.length ? new Set(allowedDays) : null;

  const upsert = (slot: WeekSlot): void => {
    const key = `${slot.dia}__${slot.horaInicio}`;
    const idx = index.get(key);
    if (idx !== undefined) {
      slots[idx] = slot;
    } else {
      index.set(key, slots.length);
      slots.push(slot);
    }
  };

  // ── Bloques de disponibilidad → slots "Disponible" ────────────
  for (const av of availability) {
    if (!av.activo) continue;
    if (dayFilter && !dayFilter.has(av.diaSemana)) continue;
    const startMin = parseHM(av.horaInicio);
    const endMin = parseHM(av.horaFin);
    for (let m = startMin; m + step <= endMin; m += step) {
      upsert({
        id: `av-${av.id}-${formatHM(m)}`,
        dia: av.diaSemana,
        horaInicio: formatHM(m),
        horaFin: formatHM(m + step),
        title: 'Disponible',
        kind: 'available',
      });
    }
  }

  // ── Citas tomadas → sobrescriben disponibilidad ───────────────
  const { wsDate, weDate } = weekRange(weekStart);

  for (const t of taken) {
    const d = new Date(t.scheduledAt);
    if (d < wsDate || d >= weDate) continue;

    const dia = dayIdxToKey(d.getDay());
    if (!dia) continue;
    if (dayFilter && !dayFilter.has(dia)) continue;

    const startMin = d.getHours() * 60 + d.getMinutes();
    const dur = t.durationMin ?? step;

    for (let m = startMin; m < startMin + dur; m += step) {
      upsert({
        id: `taken-${t.id}-${formatHM(m)}`,
        dia: dia as DiaSemana,
        horaInicio: formatHM(m),
        horaFin: formatHM(m + step),
        title: titleForEstado(t.estado),
        kind: 'taken',
      });
    }
  }

  return slots;
}

// ── buildBookingSlots (legacy) ────────────────────────────────────
// Mantiene compatibilidad con componentes que usan CalendarSlot.
// Preferir buildWeekBookingSlots en código nuevo.

export function buildBookingSlots(
  availability: AccountAvailability[],
  taken: SlotTaken[],
  weekStart: string,
  slotMinutes: number = DEFAULT_SLOT_MINUTES,
  allowedDays?: readonly string[] | null,
): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const index = new Map<string, number>();
  const step = slotMinutes > 0 ? slotMinutes : DEFAULT_SLOT_MINUTES;
  const dayFilter = allowedDays?.length ? new Set(allowedDays) : null;

  const upsert = (slot: CalendarSlot): void => {
    const key = `${slot.diaSemana}__${slot.startTime}`;
    const idx = index.get(key);
    if (idx !== undefined) {
      slots[idx] = slot;
    } else {
      index.set(key, slots.length);
      slots.push(slot);
    }
  };

  for (const av of availability) {
    if (!av.activo) continue;
    if (dayFilter && !dayFilter.has(av.diaSemana)) continue;
    const startMin = parseHM(av.horaInicio);
    const endMin = parseHM(av.horaFin);
    for (let m = startMin; m + step <= endMin; m += step) {
      upsert({
        id: `av-${av.id}-${formatHM(m)}`,
        title: 'Disponible',
        type: 'available',
        startTime: formatHM(m),
        endTime: formatHM(m + step),
        diaSemana: av.diaSemana,
      });
    }
  }

  const { wsDate, weDate } = weekRange(weekStart);

  for (const t of taken) {
    const d = new Date(t.scheduledAt);
    if (d < wsDate || d >= weDate) continue;

    const dia = dayIdxToKey(d.getDay());
    if (!dia) continue;
    if (dayFilter && !dayFilter.has(dia)) continue;

    const startMin = d.getHours() * 60 + d.getMinutes();
    const dur = t.durationMin ?? step;

    for (let m = startMin; m < startMin + dur; m += step) {
      upsert({
        id: `taken-${t.id}-${formatHM(m)}`,
        title: titleForEstado(t.estado),
        type: 'taken',
        startTime: formatHM(m),
        endTime: formatHM(m + step),
        diaSemana: dia as DiaSemana,
      });
    }
  }

  return slots;
}