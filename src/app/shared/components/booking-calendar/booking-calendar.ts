import {
  ChangeDetectionStrategy, Component, computed, input, output,
} from '@angular/core';

import { WeekGrid } from '../week-grid/week-grid';
import {
  WeekDia, WeekGridCellClick, WeekSlot, isWeekDia, toHHMM, toMin,
} from '../week-grid/week-grid.types';
import { AccountAvailability, DiaSemana, SlotTaken } from '../../../core/models/appointments';
import { buildWeekBookingSlots } from '../../utils/week-booking-slots';
import { dateFromWeekAndDia } from '../../utils/calendar-week';

/**
 * Slot seleccionado por el usuario en modo booking.
 * El componente puede recibir múltiples para soportar selección de bloques contiguos
 * (ej: una cita de 60 min = 2 slots de 30 min adyacentes).
 */
export interface BookingSelectedSlot {
  readonly dia: DiaSemana;
  readonly hour: string; // HH:mm — hora de inicio del bloque
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
  readonly allowedDays = input<readonly DiaSemana[] | readonly string[] | null>(null);
  readonly emptyMessage = input<string>('No hay disponibilidad configurada en este horario.');

  /**
   * Lista de slots seleccionados por el usuario.
   * Cada slot se pinta como "Tu selección" sobre la grilla.
   * Para selección simple, pasar un array de un solo elemento.
   * @since v2
   */
  readonly selectedSlots = input<readonly BookingSelectedSlot[]>([]);

  /** @deprecated Usar `selectedSlots`. Se mantiene por retrocompatibilidad. */
  readonly selectedDia = input<DiaSemana | null>(null);
  /** @deprecated Usar `selectedSlots`. Se mantiene por retrocompatibilidad. */
  readonly selectedHour = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────
  readonly pick = output<BookingPickEvent>();
  readonly weekChange = output<string>();

  // ── Selección efectiva ────────────────────────────────────────
  /**
   * Normaliza la selección — prioriza `selectedSlots` (nueva API).
   * Si está vacío y los singulares legados están seteados, los usa como fallback.
   */
  private readonly effectiveSelection = computed<readonly BookingSelectedSlot[]>(() => {
    const arr = this.selectedSlots();
    if (arr.length > 0) return arr;
    const dia = this.selectedDia();
    const hour = this.selectedHour();
    return dia && hour ? [{ dia, hour }] : [];
  });

  /** Set de "dia|hour" para lookup O(1) — se usa en colisiones y en filtrado. */
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

  readonly weekSlots = computed<WeekSlot[]>(() => {
    const base = buildWeekBookingSlots({
      availability: this.availability(),
      taken: this.slotsTaken(),
      weekStart: this.weekStart(),
      allowedDays: this.allowedDays(),
    });

    // Agregar un slot virtual "Tu selección" por cada item seleccionado.
    // Se renderiza encima del slot 'available' subyacente (mismo dia/hora).
    const dur = this.slotMinutes();
    for (const sel of this.effectiveSelection()) {
      const startMin = toMin(sel.hour);
      base.push({
        id: `__sel-${sel.dia}-${sel.hour}`,
        dia: sel.dia,
        horaInicio: sel.hour,
        horaFin: toHHMM(startMin + dur),
        title: 'Tu selección',
        kind: 'appointment',
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
    const dur = this.slotMinutes();

    // El click debe caber dentro del slot 'available' base
    if (startMin + dur > toMin(slot.horaFin)) return;

    // No colisionar con slots realmente ocupados (ignora los pendientes/selección)
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

  /**
   * Verifica si un rango [startMin, startMin+dur) colisiona con algún slot 'taken'.
   * Los slots virtuales de selección (pending) NO cuentan como ocupados — eso permite
   * re-clickear sobre la propia selección para hacer toggle off.
   */
  private collidesWithTaken(dia: string, startMin: number, dur: number): boolean {
    const end = startMin + dur;
    const selKeys = this.selectionKeys();

    for (const s of this.weekSlots()) {
      if (s.dia !== dia) continue;
      if (s.kind !== 'taken') continue;
      // Salvaguarda: si por cualquier razón un slot pending fuera marcado taken,
      // se ignora si pertenece a la selección actual.
      if (s.pending && selKeys.has(`${s.dia}|${s.horaInicio}`)) continue;
      if (startMin < toMin(s.horaFin) && end > toMin(s.horaInicio)) return true;
    }
    return false;
  }
}