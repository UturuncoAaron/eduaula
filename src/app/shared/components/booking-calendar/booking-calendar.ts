import {
  ChangeDetectionStrategy, Component, computed, input, output,
} from '@angular/core';

import { WeekGrid } from '../week-grid/week-grid';
import {
  WeekDia, WeekGridCellClick, WeekSlot, isWeekDia, toHHMM, toMin,
} from '../week-grid/week-grid.types';
// IMPORTANTE: Agregamos "Appointment" a la importación
import { AccountAvailability, DiaSemana, SlotTaken, Appointment } from '../../../core/models/appointments';
import { buildWeekBookingSlots } from '../../utils/week-booking-slots';
import { dateFromWeekAndDia } from '../../utils/calendar-week';

export interface BookingSelectedSlot {
  readonly dia: DiaSemana;
  readonly hour: string;
}

export interface BookingPickEvent {
  dia: DiaSemana;
  hour: string;
  date: Date;
  endHour: string;
  durationMin: number;
}

@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekGrid],
  templateUrl: './booking-calendar.html',
  styleUrl: './booking-calendar.scss',
})
export class BookingCalendar {
  // ── Inputs ────────────────────────────────────────────────────
  readonly availability = input<AccountAvailability[]>([]);
  readonly slotsTaken = input<SlotTaken[]>([]);
  readonly weekStart = input.required<string>();
  readonly loading = input<boolean>(false);
  readonly startHour = input<number>(8);
  readonly endHour = input<number>(16);
  readonly slotMinutes = input<number>(30);
  readonly pickDurationMin = input<number | null>(null);
  readonly allowedDays = input<readonly DiaSemana[] | readonly string[] | null>(null);
  readonly emptyMessage = input<string>('No hay disponibilidad configurada en este horario.');

  // 👇 NUEVOS INPUTS PARA EL APLAZAMIENTO 👇
  readonly picked = input<BookingSelectedSlot | null>(null);
  readonly originalAppointment = input<Appointment | null>(null);

  readonly selectedSlots = input<readonly BookingSelectedSlot[]>([]);
  readonly selectedDia = input<DiaSemana | null>(null);
  readonly selectedHour = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────
  readonly pick = output<BookingPickEvent>();
  readonly weekChange = output<string>();

  // ── Selección efectiva ────────────────────────────────────────
  private readonly effectiveSelection = computed<readonly BookingSelectedSlot[]>(() => {
    // 1. Si viene del input "picked" (modal de aplazar), lo priorizamos
    const p = this.picked();
    if (p) return [p];

    // 2. Si viene de selectedSlots (v2)
    const arr = this.selectedSlots();
    if (arr.length > 0) return arr;

    // 3. Fallback legado
    const dia = this.selectedDia();
    const hour = this.selectedHour();
    return dia && hour ? [{ dia, hour }] : [];
  });

  private readonly selectionKeys = computed<ReadonlySet<string>>(() => {
    const s = new Set<string>();
    for (const sel of this.effectiveSelection()) s.add(`${sel.dia}|${sel.hour}`);
    return s;
  });

  // ── Computed expuestos al template ────────────────────────────
  readonly allowedWeekDays = computed<readonly WeekDia[] | null>(() => {
    const raw = this.allowedDays();
    if (!raw?.length) return null;
    const out: WeekDia[] = [];
    for (const d of raw) if (isWeekDia(d)) out.push(d as WeekDia);
    return out;
  });

  private readonly effectivePickDuration = computed<number>(() => {
    const explicit = this.pickDurationMin();
    if (explicit != null && explicit > 0) return explicit;
    return this.slotMinutes();
  });

  // 👇 AQUÍ SUCEDE LA MAGIA VISUAL 👇
  readonly weekSlots = computed<WeekSlot[]>(() => {
    const step = this.slotMinutes();
    const base = buildWeekBookingSlots({
      availability: this.availability(),
      taken: this.slotsTaken(),
      weekStart: this.weekStart(),
      allowedDays: this.allowedDays(),
      slotMinutes: step,
    });

    // 1. Agregar "Horario Anterior" de la cita original
    const orig = this.originalAppointment();
    if (orig) {
      const d = new Date(orig.scheduledAt);

      // Validamos que la cita original caiga en la semana que estamos mirando actualmente
      const wsStr = this.weekStart();
      const wsDate = new Date(wsStr.includes('T') ? wsStr : `${wsStr}T00:00:00`);
      const nextWsDate = new Date(wsDate);
      nextWsDate.setDate(nextWsDate.getDate() + 7);

      if (d >= wsDate && d < nextWsDate) {
        const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as DiaSemana[]; const diaOrig = dias[d.getDay()];
        const startMinOrig = d.getHours() * 60 + d.getMinutes();
        const durOrig = orig.durationMin ?? step;

        base.push({
          id: `__orig-${orig.id}`,
          dia: diaOrig,
          horaInicio: toHHMM(startMinOrig),
          horaFin: toHHMM(startMinOrig + durOrig),
          title: 'Horario anterior',
          kind: 'taken', // Se pinta como gris para indicar que está "bloqueado"
          pending: false,
        });
      }
    }

    // 2. Agregar el "Nuevo horario" (La selección actual)
    const dur = this.effectivePickDuration();
    for (const sel of this.effectiveSelection()) {
      const startMin = toMin(sel.hour);
      base.push({
        id: `__sel-${sel.dia}-${sel.hour}`,
        dia: sel.dia,
        horaInicio: sel.hour,
        horaFin: toHHMM(startMin + dur),
        title: orig ? 'Nuevo horario' : 'Tu selección',
        kind: 'appointment', // Se pinta verde/resaltado
        pending: true,
      });
    }

    return base;
  });

  readonly hasAnyAvailable = computed(() => this.availability().some(a => a.activo));

  // ── Event handlers ────────────────────────────────────────────
  onCellClick(ev: WeekGridCellClick): void {
    const slot = this.findAvailableAt(ev.dia, ev.hora);
    if (!slot) return;

    const date = dateFromWeekAndDia(this.weekStart(), ev.dia as DiaSemana);
    if (!date) return;

    const startMin = toMin(ev.hora);
    const dur = this.effectivePickDuration();

    if (!this.rangeIsAvailable(ev.dia, startMin, dur)) return;
    if (this.collidesWithTaken(ev.dia, startMin, dur)) return;

    this.pick.emit({
      dia: ev.dia as DiaSemana,
      hour: ev.hora,
      date,
      endHour: toHHMM(startMin + dur),
      durationMin: dur,
    });
  }

  onWeekChange(weekStart: string): void {
    this.weekChange.emit(weekStart);
  }

  // ── Lookups internos ──────────────────────────────────────────
  private findAvailableAt(dia: WeekDia | string, hora: string): WeekSlot | null {
    const m = toMin(hora);
    for (const s of this.weekSlots()) {
      if (s.dia !== dia || s.kind !== 'available') continue;
      if (m >= toMin(s.horaInicio) && m < toMin(s.horaFin)) return s;
    }
    return null;
  }

  private rangeIsAvailable(dia: string, startMin: number, dur: number): boolean {
    const end = startMin + dur;
    const step = this.slotMinutes();
    if (step <= 0) return false;
    let cursor = startMin;
    const slots = this.weekSlots();
    while (cursor < end) {
      let found = false;
      for (const s of slots) {
        if (s.dia !== dia || s.kind !== 'available') continue;
        const sa = toMin(s.horaInicio);
        const sb = toMin(s.horaFin);
        if (cursor >= sa && cursor < sb) {
          found = true;
          break;
        }
      }
      if (!found) return false;
      cursor += step;
    }
    return true;
  }

  private collidesWithTaken(dia: string, startMin: number, dur: number): boolean {
    const end = startMin + dur;
    const selKeys = this.selectionKeys();

    for (const s of this.weekSlots()) {
      if (s.dia !== dia) continue;
      if (s.kind !== 'taken') continue;
      if (s.pending && selKeys.has(`${s.dia}|${s.horaInicio}`)) continue;
      if (startMin < toMin(s.horaFin) && end > toMin(s.horaInicio)) return true;
    }
    return false;
  }
}