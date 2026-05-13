import {
  ChangeDetectionStrategy, Component, computed, input, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  DIAS,
  DiaSemana,
  EditableSlot,
  DAY_START_MIN,
  DAY_END_MIN,
  PX_PER_MIN,
  TICK_STEP_MIN,
  toMinutes,
  toHHMM,
  snapDown,
} from './schedule-editor.types';

interface TickRow {
  /** Minuto absoluto del inicio del bloque (relativo a 00:00). */
  startMin: number;
  /** Label tipo "07:00 – 07:30". */
  rangeLabel: string;
  /** Sólo la hora de inicio "07:00" para la columna izquierda. */
  startLabel: string;
}

interface RenderedSlot {
  slot: EditableSlot;
  topPx: number;
  heightPx: number;
}

/**
 * Grilla visual del horario semanal. Renderiza:
 * - columna de horas con rangos (07:00 – 07:30).
 * - 5 columnas día con guías cada 30 min como background.
 * - slots posicionados a píxel exacto según sus minutos reales.
 *
 * Eventos:
 * - `createAt`: el usuario hizo click en el background de un día (no en un slot).
 *   Devuelve día + hora_inicio snappeada al múltiplo de 30 min más cercano hacia abajo.
 * - `editSlot`: click en un slot existente.
 */
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

  readonly createAt = output<{ dia: DiaSemana; hora: string }>();
  readonly editSlot = output<EditableSlot>();

  readonly dias = DIAS;

  readonly rows = computed<TickRow[]>(() => {
    const out: TickRow[] = [];
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += TICK_STEP_MIN) {
      out.push({
        startMin: m,
        startLabel: toHHMM(m),
        rangeLabel: `${toHHMM(m)} – ${toHHMM(m + TICK_STEP_MIN)}`,
      });
    }
    return out;
  });

  /** Altura total de la columna del día en px. */
  readonly columnHeightPx = computed(() =>
    (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN,
  );

  /** Slots agrupados por día con posición ya pre-calculada. */
  readonly slotsByDay = computed<Record<DiaSemana, RenderedSlot[]>>(() => {
    const acc = {
      lunes: [], martes: [], miercoles: [], jueves: [], viernes: [],
    } as Record<DiaSemana, RenderedSlot[]>;
    for (const s of this.slots()) {
      const inicio = toMinutes(s.hora_inicio);
      const fin = toMinutes(s.hora_fin);
      // Clampeamos al rango visible para que no se "salgan" si alguien guardó
      // un slot fuera del rango (defensive — no debería pasar con el dialog).
      const visStart = Math.max(inicio, DAY_START_MIN);
      const visEnd = Math.min(fin, DAY_END_MIN);
      if (visEnd <= visStart) continue;
      acc[s.dia_semana].push({
        slot: s,
        topPx: (visStart - DAY_START_MIN) * PX_PER_MIN,
        heightPx: (visEnd - visStart) * PX_PER_MIN,
      });
    }
    return acc;
  });

  // ─── Interacciones ─────────────────────────────────────────────
  /** Click en el background de la columna del día (no en un slot). */
  onColumnClick(event: MouseEvent, dia: DiaSemana): void {
    // Si el click vino de un slot, los handlers de slot llaman stopPropagation,
    // así que acá sólo recibimos clicks en el contenedor de la columna.
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const min = DAY_START_MIN + (y / PX_PER_MIN);
    const snapped = snapDown(Math.max(DAY_START_MIN, Math.min(min, DAY_END_MIN - TICK_STEP_MIN)));
    this.createAt.emit({ dia, hora: toHHMM(snapped) });
  }

  onSlotClick(event: MouseEvent, slot: EditableSlot): void {
    event.stopPropagation();
    this.editSlot.emit(slot);
  }

  /** Para track-by en el @for de slots. */
  trackSlot(_i: number, r: RenderedSlot): string | number {
    return r.slot.id;
  }
}
