import {
  ChangeDetectionStrategy, Component, computed,
  HostListener, input, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  WEEK_DIAS, WeekDia, WeekDiaInfo, WeekGridCellClick,
  WeekGridMode, WeekSlot, addDays, getMondayOf,
  snapDown, toHHMM, toMin,
} from './week-grid.types';

interface TickRow {
  startMin: number;
  startLabel: string;
  rangeLabel: string;
}

interface RenderedSlot {
  slot: WeekSlot;
  topPx: number;
  heightPx: number;
}

interface DayHeader {
  info: WeekDiaInfo;
  dateLabel: number | null;
  iso: string | null;
  isToday: boolean;
  allowed: boolean;
}

@Component({
  selector: 'app-week-grid',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-grid.html',
  styleUrl: './week-grid.scss',
})
export class WeekGrid {
  readonly mode = input<WeekGridMode>('schedule');
  readonly slots = input<WeekSlot[]>([]);
  readonly startHour = input<number>(7);
  readonly endHour = input<number>(17);
  readonly endHourExtraMin = input<number>(30);
  readonly tickStepMin = input<number>(30);
  readonly pxPerMin = input<number>(1.6);
  readonly showDates = input<boolean>(false);
  readonly weekStart = input<string>('');
  readonly allowedDays = input<readonly WeekDia[] | null>(null);
  readonly showNav = input<boolean>(false);
  readonly emptyLabel = input<string | null>(null);

  readonly cellClick = output<WeekGridCellClick>();
  readonly slotClick = output<WeekSlot>();
  readonly weekChange = output<string>();

  readonly dayStartMin = computed(() => this.startHour() * 60);
  readonly dayEndMin = computed(() => this.endHour() * 60 + this.endHourExtraMin());
  readonly columnHeightPx = computed(() => (this.dayEndMin() - this.dayStartMin()) * this.pxPerMin());

  readonly rows = computed<TickRow[]>(() => {
    const out: TickRow[] = [];
    const step = this.tickStepMin();
    for (let m = this.dayStartMin(); m < this.dayEndMin(); m += step) {
      out.push({ startMin: m, startLabel: toHHMM(m), rangeLabel: `${toHHMM(m)} – ${toHHMM(m + step)}` });
    }
    return out;
  });

  readonly headers = computed<DayHeader[]>(() => {
    const allowed = this.allowedDays();
    const allowSet = allowed ? new Set(allowed) : null;
    const wStart = this.weekStart();
    const showD = this.showDates();
    const todayIso = isoToday();

    return WEEK_DIAS.map((info, idx) => {
      let iso: string | null = null;
      let dateLabel: number | null = null;
      let isToday = false;
      if (showD && wStart) {
        iso = addDays(wStart, idx);
        const [, , dd] = iso.split('-').map(Number);
        dateLabel = dd;
        isToday = iso === todayIso;
      }
      return { info, dateLabel, iso, isToday, allowed: allowSet ? allowSet.has(info.key) : true };
    });
  });

  readonly slotsByDay = computed<Record<WeekDia, RenderedSlot[]>>(() => {
    const acc: Record<WeekDia, RenderedSlot[]> = {
      lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [],
    };
    const dayStart = this.dayStartMin();
    const dayEnd = this.dayEndMin();
    const px = this.pxPerMin();

    for (const s of this.slots()) {
      const inicio = toMin(s.horaInicio);
      const fin = toMin(s.horaFin);
      const visStart = Math.max(inicio, dayStart);
      const visEnd = Math.min(fin, dayEnd);
      if (visEnd <= visStart) continue;
      acc[s.dia].push({
        slot: s,
        topPx: (visStart - dayStart) * px,
        heightPx: (visEnd - visStart) * px,
      });
    }
    return acc;
  });

  readonly isEmpty = computed(() => this.slots().length === 0);

  onColumnClick(event: MouseEvent, header: DayHeader): void {
    if (!this.allowsCellClick() || !header.allowed) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const step = this.tickStepMin();
    const minRaw = this.dayStartMin() + y / this.pxPerMin();
    const clamped = Math.max(this.dayStartMin(), Math.min(minRaw, this.dayEndMin() - step));
    const snapped = snapDown(clamped, step);
    this.cellClick.emit({ dia: header.info.key, hora: toHHMM(snapped) });
  }

  onSlotClick(event: MouseEvent, slot: WeekSlot): void {
    event.stopPropagation();

    if (slot.kind === 'taken' || slot.kind === 'blocked') return;
    if (this.mode() === 'schedule') return;

    if (this.mode() === 'booking' || this.mode() === 'availability') {
      // Slots disponibles Y el slot de selección activa (pending) emiten cellClick
      // para que BookingCalendar pueda procesar cambios de selección
      if (slot.kind === 'available' || (slot.kind === 'appointment' && slot.pending)) {
        const slotEl = event.currentTarget as HTMLElement;
        const colEl = slotEl.parentElement;
        if (!colEl) return;
        const rect = colEl.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const step = this.tickStepMin();
        const minRaw = this.dayStartMin() + y / this.pxPerMin();
        const clamped = Math.max(this.dayStartMin(), Math.min(minRaw, this.dayEndMin() - step));
        const snapped = snapDown(clamped, step);
        this.cellClick.emit({ dia: slot.dia, hora: toHHMM(snapped) });
        return;
      }
    }

    this.slotClick.emit(slot);
  }

  trackHeader = (_: number, h: DayHeader) => h.info.key;
  trackSlot = (_: number, r: RenderedSlot) => r.slot.id;
  trackRow = (_: number, r: TickRow) => r.startMin;

  prevWeek(): void { const w = this.weekStart(); if (w) this.weekChange.emit(addDays(w, -7)); }
  nextWeek(): void { const w = this.weekStart(); if (w) this.weekChange.emit(addDays(w, 7)); }
  goToday(): void { this.weekChange.emit(getMondayOf(new Date())); }

  private allowsCellClick(): boolean {
    const m = this.mode();
    return m === 'editor' || m === 'availability' || m === 'booking';
  }

  @HostListener('window:keydown.arrowleft')
  onArrowLeft(): void { if (this.showNav() && this.showDates()) this.prevWeek(); }

  @HostListener('window:keydown.arrowright')
  onArrowRight(): void { if (this.showNav() && this.showDates()) this.nextWeek(); }
}

function isoToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}