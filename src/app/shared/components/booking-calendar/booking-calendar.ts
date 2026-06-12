import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { WeekGrid } from '../week-grid/week-grid';
import {
  WeekDia, WeekGridCellClick, WeekSlot, isWeekDia, toHHMM, toMin,
} from '../week-grid/week-grid.types';
import { AccountAvailability, DiaSemana, SlotTaken, Appointment, AvailabilityOverrideDay } from '../../../core/models/appointments';
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
  readonly availability = input<AccountAvailability[]>([]);
  readonly overrides = input<AvailabilityOverrideDay[]>([]);
  readonly slotsTaken = input<SlotTaken[]>([]);
  readonly weekStart = input.required<string>();
  readonly loading = input<boolean>(false);
  readonly startHour = input<number>(8);
  readonly endHour = input<number>(16);
  readonly slotMinutes = input<number>(30);
  readonly pickDurationMin = input<number | null>(null);
  readonly allowedDays = input<readonly DiaSemana[] | readonly string[] | null>(null);
  readonly emptyMessage = input<string>('No hay disponibilidad configurada en este horario.');

  readonly picked = input<BookingSelectedSlot | null>(null);
  readonly originalAppointment = input<Appointment | null>(null);

  readonly selectedSlots = input<readonly BookingSelectedSlot[]>([]);
  readonly selectedDia = input<DiaSemana | null>(null);
  readonly selectedHour = input<string | null>(null);

  readonly pick = output<BookingPickEvent>();
  readonly weekChange = output<string>();

  private readonly effectiveSelection = computed<readonly BookingSelectedSlot[]>(() => {
    const p = this.picked();
    if (p) return [p];
    const arr = this.selectedSlots();
    if (arr.length > 0) return arr;
    const dia = this.selectedDia();
    const hour = this.selectedHour();
    return dia && hour ? [{ dia, hour }] : [];
  });

  private readonly selectionKeys = computed<ReadonlySet<string>>(() => {
    const s = new Set<string>();
    for (const sel of this.effectiveSelection()) s.add(`${sel.dia}|${sel.hour}`);
    return s;
  });

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

  readonly weekSlots = computed<WeekSlot[]>(() => {
    const step = this.slotMinutes();
    const base = buildWeekBookingSlots({
      availability: this.availability(),
      taken: this.slotsTaken(),
      weekStart: this.weekStart(),
      allowedDays: this.allowedDays(),
      slotMinutes: step,
    });

    const ovs = this.overrides() ?? [];
    const blockedDates = new Set(ovs.filter(o => o.slots?.length === 0).map(o => o.date));
    const pad = (n: number) => String(n).padStart(2, '0');

    const filteredBase = base.filter(s => {
      const idx = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].indexOf(s.dia);
      if (idx === -1) return true;
      const ref = new Date(`${this.weekStart()}T00:00:00`);
      ref.setDate(ref.getDate() + idx);
      const slotDateIso = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(ref.getDate())}`;
      return !blockedDates.has(slotDateIso);
    });

    const orig = this.originalAppointment();
    if (orig) {
      const d = new Date(orig.scheduledAt);
      const wsStr = this.weekStart();
      const wsDate = new Date(wsStr.includes('T') ? wsStr : `${wsStr}T00:00:00`);
      const nextWsDate = new Date(wsDate);
      nextWsDate.setDate(nextWsDate.getDate() + 7);

      if (d >= wsDate && d < nextWsDate) {
        const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as DiaSemana[];
        const diaOrig = dias[d.getDay()];
        const startMinOrig = d.getHours() * 60 + d.getMinutes();
        const durOrig = orig.durationMin ?? step;

        filteredBase.push({
          id: `__orig-${orig.id}`,
          dia: diaOrig,
          horaInicio: toHHMM(startMinOrig),
          horaFin: toHHMM(startMinOrig + durOrig),
          title: 'Horario anterior',
          kind: 'taken',
          pending: false,
        });
      }
    }

    const dur = this.effectivePickDuration();
    for (const sel of this.effectiveSelection()) {
      const startMin = toMin(sel.hour);
      filteredBase.push({
        id: `__sel-${sel.dia}-${sel.hour}`,
        dia: sel.dia,
        horaInicio: sel.hour,
        horaFin: toHHMM(startMin + dur),
        title: orig ? 'Nuevo horario' : 'Tu selección',
        kind: 'appointment',
        pending: true,
      });
    }

    return filteredBase;
  });

  readonly hasAnyAvailable = computed(() => {
    return this.weekSlots().some(s => s.kind === 'available');
  });

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