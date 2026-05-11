import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CalendarMode,
  CalendarSlot,
  CalendarDayEvent,
  CalendarCellClickEvent,
} from './calendar-grid.types';

const DIAS = [
  { key: 'lunes', short: 'Lun', long: 'Lunes' },
  { key: 'martes', short: 'Mar', long: 'Martes' },
  { key: 'miercoles', short: 'Mié', long: 'Miércoles' },
  { key: 'jueves', short: 'Jue', long: 'Jueves' },
  { key: 'viernes', short: 'Vie', long: 'Viernes' },
] as const;

const MIN_PER_SLOT = 30;

interface DayInfo {
  key: string;
  short: string;
  long: string;
  date: string;       // 'YYYY-MM-DD'
  dateLabel: number;  // day of month
  isToday: boolean;
}

interface CellVM {
  cellKey: string;
  dia: string;
  hour: string;
  gridColumn: number;
  gridRow: number;
  slot?: CalendarSlot;
  classes: Record<string, boolean>;
  interactive: boolean;
}

@Component({
  selector: 'app-calendar-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './calendar-grid.html',
  styleUrl: './calendar-grid.scss',
  host: {
    class: 'cal-host',
    '[class.cal-host--loading]': 'loading()',
  },
})
export class CalendarGrid {
  // ── Inputs ────────────────────────────────────────────────
  readonly mode = input.required<CalendarMode>();
  readonly slots = input<CalendarSlot[]>([]);
  readonly events = input<CalendarDayEvent[]>([]);
  readonly loading = input<boolean>(false);
  readonly weekStart = input<string>(getTodayMonday());
  readonly startHour = input<number>(7);
  readonly endHour = input<number>(20);
  readonly hideNav = input<boolean>(false);
  /** null → el calendario crece a su contenido (sin scroll interno). */
  readonly maxBodyHeight = input<number | null>(480);
  /** Celda actualmente seleccionada — formato 'dia__HH:mm'. Solo se pinta
   * cuando el modo lo soporta (ej. booking). */
  readonly selectedKey = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────
  readonly cellClick = output<CalendarCellClickEvent>();
  readonly weekChange = output<string>();

  // ── State ─────────────────────────────────────────────────
  private readonly hoveredCell = signal<string | null>(null);

  // ── Computed ──────────────────────────────────────────────
  readonly hours = computed<string[]>(() =>
    buildHours(this.startHour(), this.endHour()),
  );

  readonly weekDates = computed<DayInfo[]>(() => {
    const monday = parseLocalDate(this.weekStart());
    const today = new Date();
    return DIAS.map((d, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        key: d.key,
        short: d.short,
        long: d.long,
        date: formatDate(date),
        dateLabel: date.getDate(),
        isToday: isSameDay(date, today),
      };
    });
  });

  private readonly slotsByKey = computed(() => {
    const m = new Map<string, CalendarSlot>();
    for (const s of this.slots()) {
      m.set(`${s.diaSemana}__${s.startTime}`, s);
    }
    return m;
  });

  readonly eventsByDate = computed(() => {
    const m = new Map<string, CalendarDayEvent[]>();
    for (const ev of this.events()) {
      const list = m.get(ev.date) ?? [];
      list.push(ev);
      m.set(ev.date, list);
    }
    return m;
  });

  readonly hasAnyEvent = computed(() => this.events().length > 0);

  readonly existingTypes = computed(() => {
    const set = new Set<string>();
    for (const s of this.slots()) set.add(s.type);
    for (const ev of this.events()) set.add(ev.type);
    return set;
  });
  readonly cells = computed<CellVM[]>(() => {
    const slots = this.slotsByKey();
    const m = this.mode();
    const days = this.weekDates();
    const hours = this.hours();
    const hovered = this.hoveredCell();
    const selected = this.selectedKey();

    const out: CellVM[] = new Array(days.length * hours.length);
    let idx = 0;
    for (let d = 0; d < days.length; d++) {
      const day = days[d];
      for (let h = 0; h < hours.length; h++) {
        const hour = hours[h];
        const cellKey = `${day.key}__${hour}`;
        const slot = slots.get(cellKey);
        const interactive = isInteractive(m, slot);
        out[idx++] = {
          cellKey,
          dia: day.key,
          hour,
          gridColumn: d + 2,  // col 1 = horas
          gridRow: h + 2,     // row 1 = headers
          slot,
          interactive,
          classes: {
            'cal__cell--has-slot': !!slot,
            'cal__cell--course': slot?.type === 'course',
            'cal__cell--appointment': slot?.type === 'appointment',
            'cal__cell--available': slot?.type === 'available',
            'cal__cell--taken': slot?.type === 'taken',
            'cal__cell--event': slot?.type === 'event',
            'cal__cell--interactive': interactive,
            'cal__cell--hovered': hovered === cellKey,
            'cal__cell--selected': selected === cellKey,
            'cal__cell--editor-empty': m === 'editor' && !slot,
          },
        };
      }
    }
    return out;
  });

  /** Total de filas del grid: 1 (header) + N (horas). */
  readonly totalRows = computed(() => 1 + this.hours().length);

  // ── Acciones ──────────────────────────────────────────────
  prevWeek(): void { this.weekChange.emit(addDays(this.weekStart(), -7)); }
  nextWeek(): void { this.weekChange.emit(addDays(this.weekStart(), 7)); }
  goToday(): void { this.weekChange.emit(getTodayMonday()); }

  onCellClick(cell: CellVM): void {
    if (!cell.interactive) return;
    this.cellClick.emit({
      diaSemana: cell.dia,
      startTime: cell.hour,
      endTime: addMinutesToTime(cell.hour, MIN_PER_SLOT),
      slot: cell.slot,
    });
  }

  onCellHover(cellKey: string | null): void {
    this.hoveredCell.set(cellKey);
  }

  // ── Helpers de plantilla ──────────────────────────────────
  formatHour(h: string): string {
    const [hh, mm] = h.split(':');
    const hour = parseInt(hh, 10);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h12}:${mm} ${ampm}`;
  }

  trackByCell = (_: number, c: CellVM): string => c.cellKey;
  trackByDay = (_: number, d: DayInfo): string => d.key;
  trackByHour = (_: number, h: string): string => h;
  trackByEvent = (_: number, e: CalendarDayEvent): string => `${e.date}__${e.title}`;
}

// ── Funciones puras ──────────────────────────────────────────
function buildHours(startHour: number, endHour: number): string[] {
  const out: string[] = [];
  const start = Math.max(0, Math.min(24, startHour));
  const end = Math.max(start, Math.min(24, endHour));
  for (let h = start; h < end; h++) {
    out.push(`${pad2(h)}:00`);
    out.push(`${pad2(h)}:30`);
  }
  return out;
}

function isInteractive(mode: CalendarMode, slot?: CalendarSlot): boolean {
  switch (mode) {
    case 'schedule': return !!slot;
    case 'availability': return true;
    case 'booking': return slot?.type === 'available';
    case 'editor': return true;
    default: return false;
  }
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

function getTodayMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Dom
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}