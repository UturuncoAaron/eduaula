import {
  ChangeDetectionStrategy, Component, computed, input, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  DIAS, DiaSemana, EditableSlot,
  toMinutes, toHHMM, PERIOD_TICKS, snapToNearestPeriod,
} from './schedule-editor.types';

interface TickRow {
  startMin: number;
  endMin: number;
  rangeLabel: string;
  startLabel: string;
  isBreak: boolean;
  breakLabel?: string;
}

interface RenderedSlot {
  slot: EditableSlot;
  topPx: number;
  heightPx: number;
}

@Component({
  selector: 'app-schedule-grid',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-grid.html',
  styleUrl: './schedule-grid.scss',
})
export class ScheduleGrid {
  readonly slots = input.required<EditableSlot[]>();
  readonly startHour = input<number>(8);
  readonly endHour = input<number>(15);
  readonly endHourExtraMin = input<number>(30);
  readonly tickStepMin = input<number>(30);
  readonly pxPerMin = input<number>(2.4);
  readonly allowedDays = input<DiaSemana[]>(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);

  readonly createAt = output<{ dia: DiaSemana; hora: string }>();
  readonly editSlot = output<EditableSlot>();

  readonly dias = DIAS;

  readonly dayStartMin = computed(() => this.startHour() * 60);
  readonly dayEndMin = computed(() => this.endHour() * 60 + this.endHourExtraMin());
  readonly columnHeightPx = computed(() => (this.dayEndMin() - this.dayStartMin()) * this.pxPerMin());

  /** Filas del grid con recreos incluidos, cada fila tiene su propia altura */
  readonly rows = computed<TickRow[]>(() => {
    const out: TickRow[] = [];
    for (let i = 0; i < PERIOD_TICKS.length - 1; i++) {
      const cur = PERIOD_TICKS[i];
      const next = PERIOD_TICKS[i + 1];
      const startMin = toMinutes(cur.time);
      const endMin = toMinutes(next.time);
      out.push({
        startMin,
        endMin,
        startLabel: cur.time,
        rangeLabel: `${cur.time} – ${next.time}`,
        isBreak: cur.isBreak,
        breakLabel: cur.label,
      });
    }
    return out;
  });

  readonly slotsByDay = computed<Record<DiaSemana, RenderedSlot[]>>(() => {
    const acc = {
      lunes: [], martes: [], miercoles: [], jueves: [], viernes: [],
    } as Record<DiaSemana, RenderedSlot[]>;

    const dayStart = this.dayStartMin();
    const dayEnd = this.dayEndMin();
    const px = this.pxPerMin();

    for (const s of this.slots()) {
      const inicio = toMinutes(s.hora_inicio);
      const fin = toMinutes(s.hora_fin);
      const visStart = Math.max(inicio, dayStart);
      const visEnd = Math.min(fin, dayEnd);
      if (visEnd <= visStart) continue;
      acc[s.dia_semana].push({
        slot: s,
        topPx: (visStart - dayStart) * px,
        heightPx: (visEnd - visStart) * px,
      });
    }
    return acc;
  });

  /** Snap al período más cercano hacia abajo al hacer clic en la columna */
  onColumnClick(event: MouseEvent, dia: DiaSemana): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const clickedMin = this.dayStartMin() + (y / this.pxPerMin());
    const snapped = snapToNearestPeriod(clickedMin);
    this.createAt.emit({ dia, hora: toHHMM(snapped) });
  }

  onSlotClick(event: MouseEvent, slot: EditableSlot): void {
    event.stopPropagation();
    this.editSlot.emit(slot);
  }

  trackSlot(_i: number, r: RenderedSlot): string | number {
    return r.slot.id;
  }
}