import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  WEEK_DIAS,
  WeekDia,
  WeekDiaInfo,
  WeekGridCellClick,
  WeekGridMode,
  WeekSlot,
  addDays,
  getMondayOf,
  snapDown,
  toHHMM,
  toMin,
} from './week-grid.types';

interface TickRow {
  startMin: number;
  startLabel: string;       // "07:00"
  rangeLabel: string;       // "07:00 – 07:30"
}

interface RenderedSlot {
  slot: WeekSlot;
  topPx: number;
  heightPx: number;
}

interface DayHeader {
  info: WeekDiaInfo;
  /** "13" o `null` cuando showDates=false. */
  dateLabel: number | null;
  /** YYYY-MM-DD del día, sólo cuando showDates=true. */
  iso: string | null;
  isToday: boolean;
  allowed: boolean;
}

/**
 * Grilla semanal pixel-perfect compartida.
 *
 * Cada slot se renderiza en posición absolute con `top` y `height`
 * calculados desde sus minutos reales — para que un slot 07:00–09:45
 * ocupe exactamente hasta la mitad de la celda 09:30–10:00.
 *
 * Outputs:
 * - `cellClick(dia, hora)` → click en fondo libre (snappeado al step).
 * - `slotClick(slot)` → click en un slot existente.
 * - `weekChange(yyyy-mm-dd)` → cambio de semana (sólo con showDates=true).
 */
@Component({
  selector: 'app-week-grid',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-grid.html',
  styleUrl: './week-grid.scss',
})
export class WeekGrid {
  // ── Inputs ────────────────────────────────────────────────
  readonly mode = input<WeekGridMode>('schedule');
  readonly slots = input<WeekSlot[]>([]);

  /** Hora inicial del día visible (default 07:00). */
  readonly startHour = input<number>(7);
  /** Hora final del día visible (default 17:30, exclusive). */
  readonly endHour = input<number>(17);
  /** Minutos extra al endHour (0–59). Para representar 17:30 → endHour=17, endHourExtraMin=30. */
  readonly endHourExtraMin = input<number>(30);

  /** Paso del tick visual (default 30 min). */
  readonly tickStepMin = input<number>(30);

  /** Pixels por minuto. 1.6 → 30 min = 48px. */
  readonly pxPerMin = input<number>(1.6);

  /** Si true, los headers muestran la fecha (MAR 12, MIÉ 13, ...). */
  readonly showDates = input<boolean>(false);

  /** Lunes de la semana visible. Requerido cuando showDates=true. */
  readonly weekStart = input<string>('');

  /** Días permitidos. Cuando se pasa, los días fuera salen en gris. */
  readonly allowedDays = input<readonly WeekDia[] | null>(null);

  /** Habilita las flechas de navegación. Sólo tiene efecto si showDates=true. */
  readonly showNav = input<boolean>(false);

  /** Mensaje cuando no hay slots. */
  readonly emptyLabel = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────
  readonly cellClick = output<WeekGridCellClick>();
  readonly slotClick = output<WeekSlot>();
  readonly weekChange = output<string>();

  // ── State derivado ────────────────────────────────────────
  readonly dayStartMin = computed(() => this.startHour() * 60);
  readonly dayEndMin = computed(
    () => this.endHour() * 60 + this.endHourExtraMin(),
  );

  /** Altura total de la columna del día (px). */
  readonly columnHeightPx = computed(
    () => (this.dayEndMin() - this.dayStartMin()) * this.pxPerMin(),
  );

  readonly rows = computed<TickRow[]>(() => {
    const out: TickRow[] = [];
    const step = this.tickStepMin();
    for (let m = this.dayStartMin(); m < this.dayEndMin(); m += step) {
      out.push({
        startMin: m,
        startLabel: toHHMM(m),
        rangeLabel: `${toHHMM(m)} – ${toHHMM(m + step)}`,
      });
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
      return {
        info,
        dateLabel,
        iso,
        isToday,
        allowed: allowSet ? allowSet.has(info.key) : true,
      };
    });
  });

  /** Slots agrupados por día con posición ya calculada. */
  readonly slotsByDay = computed<Record<WeekDia, RenderedSlot[]>>(() => {
    const acc: Record<WeekDia, RenderedSlot[]> = {
      lunes: [],
      martes: [],
      miercoles: [],
      jueves: [],
      viernes: [],
      sabado: [],
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

  // ── Interacciones ─────────────────────────────────────────
  onColumnClick(event: MouseEvent, header: DayHeader): void {
    if (!this.allowsCellClick() || !header.allowed) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const step = this.tickStepMin();
    const minRaw = this.dayStartMin() + y / this.pxPerMin();
    const clamped = Math.max(
      this.dayStartMin(),
      Math.min(minRaw, this.dayEndMin() - step),
    );
    const snapped = snapDown(clamped, step);
    this.cellClick.emit({ dia: header.info.key, hora: toHHMM(snapped) });
  }

  onSlotClick(event: MouseEvent, slot: WeekSlot): void {
    event.stopPropagation();
    if (slot.kind === 'taken' || slot.kind === 'blocked') return;
    if (this.mode() === 'schedule') return;
    if (
      (this.mode() === 'booking' || this.mode() === 'availability') &&
      slot.kind === 'available'
    ) {
      // En booking/availability calculamos el paso exacto dentro del bloque
      // y emitimos cellClick para que el caller decida (reserva / toggle).
      const slotEl = event.currentTarget as HTMLElement;
      const colEl = slotEl.parentElement;
      if (!colEl) return;
      const rect = colEl.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const step = this.tickStepMin();
      const minRaw = this.dayStartMin() + y / this.pxPerMin();
      const clamped = Math.max(
        this.dayStartMin(),
        Math.min(minRaw, this.dayEndMin() - step),
      );
      const snapped = snapDown(clamped, step);
      this.cellClick.emit({ dia: slot.dia, hora: toHHMM(snapped) });
      return;
    }
    this.slotClick.emit(slot);
  }

  // Track-by helpers para template.
  trackHeader = (_: number, h: DayHeader) => h.info.key;
  trackSlot = (_: number, r: RenderedSlot) => r.slot.id;
  trackRow = (_: number, r: TickRow) => r.startMin;

  prevWeek(): void {
    const w = this.weekStart();
    if (!w) return;
    this.weekChange.emit(addDays(w, -7));
  }
  nextWeek(): void {
    const w = this.weekStart();
    if (!w) return;
    this.weekChange.emit(addDays(w, 7));
  }
  goToday(): void {
    this.weekChange.emit(getMondayOf(new Date()));
  }

  private allowsCellClick(): boolean {
    const m = this.mode();
    return m === 'editor' || m === 'availability';
  }

  @HostListener('window:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.showNav() && this.showDates()) this.prevWeek();
  }
  @HostListener('window:keydown.arrowright')
  onArrowRight(): void {
    if (this.showNav() && this.showDates()) this.nextWeek();
  }
}

function isoToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
