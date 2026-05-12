import {
  ChangeDetectionStrategy, Component, computed, input, output,
} from '@angular/core';

import { CalendarGrid } from '../calendar-grid/calendar-grid';
import {
  CalendarCellClickEvent, CalendarSlot,
} from '../calendar-grid/calendar-grid.types';

import {
  AccountAvailability, DiaSemana, SlotTaken,
} from '../../../core/models/appointments';
import { buildBookingSlots } from '../../utils/booking-slots';
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

@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarGrid],
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
   * Las celdas de availability fuera de [startHour, endHour) no se
   * renderizan, evitando ver slots fuera del horario permitido.
   */
  readonly endHour = input<number>(16);
  /** Tamaño del slot en minutos. Default 30. Define el paso del grid
   *  horario (15 → director, 30 → psicóloga, 45 → docente, etc). */
  readonly slotMinutes = input<number>(30);
  /** Si se especifica, sólo se muestran slots en estos días. */
  readonly allowedDays = input<readonly string[] | null>(null);
  readonly maxBodyHeight = input<number | null>(380);
  readonly emptyMessage = input<string>(
    'No hay disponibilidad configurada en este horario.',
  );
  readonly selectedDia = input<DiaSemana | null>(null);
  readonly selectedHour = input<string | null>(null);

  // ── Outputs ─────────────────────────────────────────────────
  readonly pick = output<BookingPickEvent>();
  readonly weekChange = output<string>();

  // ── State derivado ──────────────────────────────────────────
  readonly bookingSlots = computed<CalendarSlot[]>(() =>
    buildBookingSlots(
      this.availability(),
      this.slotsTaken(),
      this.weekStart(),
      this.slotMinutes(),
      this.allowedDays(),
    ),
  );

  readonly hasAnyAvailable = computed(() =>
    this.availability().some(a => a.activo),
  );

  readonly selectedKey = computed<string | null>(() => {
    const dia = this.selectedDia();
    const hour = this.selectedHour();
    if (!dia || !hour) return null;
    return `${dia}__${hour}`;
  });

  // ── Handlers ────────────────────────────────────────────────
  onCellClick(ev: CalendarCellClickEvent): void {
    if (!ev.slot || ev.slot.type !== 'available') return;
    const dia = ev.diaSemana as DiaSemana;
    const date = dateFromWeekAndDia(this.weekStart(), dia);
    if (!date) return;
    this.pick.emit({
      dia,
      hour: ev.startTime,
      date,
      endHour: ev.slot.endTime,
      durationMin: this.slotMinutes(),
    });
  }

  onWeekChange(weekStart: string): void {
    this.weekChange.emit(weekStart);
  }
}
