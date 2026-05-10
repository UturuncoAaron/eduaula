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
  hour: string;
  date: Date;
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
  readonly startHour = input<number>(7);
  readonly endHour = input<number>(20);
  readonly maxBodyHeight = input<number | null>(380);
  readonly emptyMessage = input<string>(
    'No hay disponibilidad configurada en este horario.',
  );

  // ── Outputs ─────────────────────────────────────────────────
  readonly pick = output<BookingPickEvent>();
  readonly weekChange = output<string>();

  // ── State derivado ──────────────────────────────────────────
  readonly bookingSlots = computed<CalendarSlot[]>(() =>
    buildBookingSlots(this.availability(), this.slotsTaken(), this.weekStart()),
  );

  readonly hasAnyAvailable = computed(() =>
    this.availability().some(a => a.activo),
  );

  // ── Handlers ────────────────────────────────────────────────
  onCellClick(ev: CalendarCellClickEvent): void {
    if (!ev.slot || ev.slot.type !== 'available') return;
    const dia = ev.diaSemana as DiaSemana;
    const date = dateFromWeekAndDia(this.weekStart(), dia);
    if (!date) return;
    this.pick.emit({ dia, hour: ev.startTime, date });
  }

  onWeekChange(weekStart: string): void {
    this.weekChange.emit(weekStart);
  }
}