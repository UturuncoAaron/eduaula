import {
  ChangeDetectionStrategy, Component, computed, input, output,
} from '@angular/core';

import { WeekGrid } from '../week-grid/week-grid';
import {
  WeekDia,
  WeekGridCellClick,
  WeekSlot,
  isWeekDia,
  toHHMM,
  toMin,
} from '../week-grid/week-grid.types';

import {
  AccountAvailability, DiaSemana, SlotTaken,
} from '../../../core/models/appointments';
import { buildWeekBookingSlots } from '../../utils/week-booking-slots';
import { dateFromWeekAndDia } from '../../utils/calendar-week';

export interface BookingPickEvent {
  dia: DiaSemana;
  /** 'HH:MM' de inicio del slot elegido. */
  hour: string;
  /** Fecha (00:00 local) del día elegido. */
  date: Date;
  /** 'HH:MM' de fin del slot (= hour + slotMinutes). */
  endHour: string;
  /** Duración en minutos del slot (= input slotMinutes). */
  durationMin: number;
}

/**
 * Componente de selección de slot para una cita. Renderiza la disponibilidad
 * del profesional como franjas verdes pixel-perfect (igual look que el
 * editor de horario admin) y los slots ya ocupados como bloques grises.
 *
 * Cuando el usuario hace click DENTRO de una franja verde, calculamos el
 * step (`slotMinutes`) correspondiente y emitimos `pick`.
 */
@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekGrid],
  templateUrl: './booking-calendar.html',
  styleUrl: './booking-calendar.scss',
})
export class BookingCalendar {
  // ── Inputs ──────────────────────────────────────────────────
  readonly availability = input<AccountAvailability[]>([]);
  readonly slotsTaken = input<SlotTaken[]>([]);
  readonly weekStart = input.required<string>();
  readonly loading = input<boolean>(false);
  /**
   * Hora inicial visible en el calendario (entero). Este valor es la
   * cota dura del rol del profesional (ej.: psicóloga=8, docente=8,
   * director=8). El caller debe derivarla siempre de la regla.
   */
  readonly startHour = input<number>(8);
  /**
   * Hora final visible en el calendario (entero, ceil al siguiente
   * entero si la regla termina en :30/:45). Cota dura del rol.
   */
  readonly endHour = input<number>(16);
  /** Tamaño del slot en minutos (15 → director, 30 → psicóloga, 45 → docente). */
  readonly slotMinutes = input<number>(30);
  /** Si se especifica, sólo se muestran slots en estos días. */
  readonly allowedDays = input<readonly DiaSemana[] | readonly string[] | null>(null);
  readonly emptyMessage = input<string>(
    'No hay disponibilidad configurada en este horario.',
  );
  readonly selectedDia = input<DiaSemana | null>(null);
  readonly selectedHour = input<string | null>(null);

  // ── Outputs ─────────────────────────────────────────────────
  readonly pick = output<BookingPickEvent>();
  readonly weekChange = output<string>();

  // ── State derivado ──────────────────────────────────────────
  /** Filtrado al subconjunto válido WeekDia para tipar el binding al week-grid. */
  readonly allowedWeekDays = computed<readonly WeekDia[] | null>(() => {
    const raw = this.allowedDays();
    if (!raw || raw.length === 0) return null;
    const out: WeekDia[] = [];
    for (const d of raw) {
      if (isWeekDia(d)) out.push(d);
    }
    return out;
  });

  readonly weekSlots = computed<WeekSlot[]>(() => {
    const base = buildWeekBookingSlots({
      availability: this.availability(),
      taken: this.slotsTaken(),
      weekStart: this.weekStart(),
      allowedDays: this.allowedDays(),
    });
    const selDia = this.selectedDia();
    const selHour = this.selectedHour();
    if (selDia && selHour) {
      const selMin = toMin(selHour);
      const dur = this.slotMinutes();
      base.push({
        id: `__sel-${selDia}-${selHour}`,
        dia: selDia,
        horaInicio: selHour,
        horaFin: toHHMM(selMin + dur),
        title: 'Tu selección',
        kind: 'appointment',
        pending: true,
      });
    }
    return base;
  });

  readonly hasAnyAvailable = computed(() =>
    this.availability().some(a => a.activo),
  );

  // ── Handlers ────────────────────────────────────────────────
  /** Click "fino" dentro de la columna — buscamos en qué franja cayó. */
  onCellClick(ev: WeekGridCellClick): void {
    const slot = this.findAvailableAt(ev.dia, ev.hora);
    if (!slot) return;
    const date = dateFromWeekAndDia(this.weekStart(), ev.dia as DiaSemana);
    if (!date) return;
    const startMin = toMin(ev.hora);
    const dur = this.slotMinutes();
    // Verificar que el slot encaje completo dentro de la franja disponible.
    const blockEnd = toMin(slot.horaFin);
    if (startMin + dur > blockEnd) return;
    // Y que no choque con un ocupado.
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

  // ── Helpers ─────────────────────────────────────────────────
  private findAvailableAt(dia: WeekDia | string, hora: string): WeekSlot | null {
    const m = toMin(hora);
    for (const s of this.weekSlots()) {
      if (s.dia !== dia) continue;
      if (s.kind !== 'available') continue;
      const ini = toMin(s.horaInicio);
      const fin = toMin(s.horaFin);
      if (m >= ini && m < fin) return s;
    }
    return null;
  }

  private collidesWithTaken(dia: string, startMin: number, dur: number): boolean {
    const end = startMin + dur;
    for (const s of this.weekSlots()) {
      if (s.dia !== dia) continue;
      if (s.kind !== 'taken') continue;
      const ini = toMin(s.horaInicio);
      const fin = toMin(s.horaFin);
      if (startMin < fin && end > ini) return true;
    }
    return false;
  }
}
