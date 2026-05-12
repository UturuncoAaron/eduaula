import {
  ChangeDetectionStrategy, Component, computed, input, output, signal, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  AccountAvailability, AppointmentRoleRule, DiaSemana,
  SetAvailabilityPayload,
  ruleToStartHour, ruleToEndHour, ruleToSlotMinutes,
} from '../../../core/models/appointments';

const ALL_DIAS: DiaSemana[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes',
];
const DIA_LABEL: Record<DiaSemana, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
};
const DEFAULT_STEP = 30;

function pad2(n: number) { return n.toString().padStart(2, '0'); }
function minToHM(m: number) { return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; }
function hmToMin(s: string) { const [h, m] = s.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); }
function cellKey(dia: DiaSemana, hm: string) { return `${dia}|${hm}`; }
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/**
 * Expande un bloque de disponibilidad a celdas individuales del editor.
 * Cada celda mide `step` minutos.
 */
function expandToCells(av: AccountAvailability, step: number): string[] {
  const out: string[] = [];
  const start = hmToMin(av.horaInicio);
  const end = hmToMin(av.horaFin);
  for (let m = start; m + step <= end; m += step) {
    out.push(cellKey(av.diaSemana, minToHM(m)));
  }
  return out;
}

/**
 * Convierte el set de celdas seleccionadas a bloques contiguos
 * (`SetAvailabilityPayload[]`) listos para enviar al BE. Las celdas
 * contiguas del mismo día se colapsan en un solo bloque.
 */
function collapseToBlocks(cells: Set<string>, step: number): SetAvailabilityPayload[] {
  const byDay: Record<string, number[]> = {};
  for (const k of cells) {
    const [dia, hm] = k.split('|');
    (byDay[dia] ??= []).push(hmToMin(hm));
  }
  const blocks: SetAvailabilityPayload[] = [];
  for (const dia of Object.keys(byDay)) {
    const mins = byDay[dia].sort((a, b) => a - b);
    let runStart: number | null = null;
    let prev: number | null = null;
    for (const m of mins) {
      if (runStart === null) { runStart = m; prev = m; continue; }
      if (m === (prev as number) + step) { prev = m; continue; }
      blocks.push({
        diaSemana: dia as DiaSemana,
        horaInicio: minToHM(runStart),
        horaFin: minToHM((prev as number) + step),
      });
      runStart = m; prev = m;
    }
    if (runStart !== null) {
      blocks.push({
        diaSemana: dia as DiaSemana,
        horaInicio: minToHM(runStart),
        horaFin: minToHM((prev as number) + step),
      });
    }
  }
  return blocks;
}

@Component({
  selector: 'app-availability-calendar-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './availability-calendar-editor.html',
  styleUrl: './availability-calendar-editor.scss',
})
export class AvailabilityCalendarEditor {
  // ── Inputs ─────────────────────────────────────────────────
  readonly initial = input<AccountAvailability[]>([]);
  readonly saving = input<boolean>(false);
  /**
   * Regla del rol que se está configurando. Si está presente, define las
   * cotas duras (horas, días permitidos y paso del grid). Sin regla el
   * editor cae a 07:00–18:00 L–V con paso 30 (modo legacy).
   */
  readonly rule = input<AppointmentRoleRule | null>(null);

  // Override manual cuando no se quiere usar el rule (legacy).
  readonly startHour = input<number | null>(null);
  readonly endHour = input<number | null>(null);

  // ── Outputs ────────────────────────────────────────────────
  readonly save = output<SetAvailabilityPayload[]>();
  readonly cancel = output<void>();

  readonly DIA_LABEL = DIA_LABEL;

  // ── Computed: cotas + días + paso ──────────────────────────
  readonly effectiveStartHour = computed<number>(() => {
    const explicit = this.startHour();
    if (explicit != null) return explicit;
    const r = this.rule();
    return r ? ruleToStartHour(r) : 7;
  });

  readonly effectiveEndHour = computed<number>(() => {
    const explicit = this.endHour();
    if (explicit != null) return explicit;
    const r = this.rule();
    return r ? ruleToEndHour(r) : 18;
  });

  /** Paso del grid: usa el slot fijo del rol o 30 min por defecto. */
  readonly step = computed<number>(() => {
    const r = this.rule();
    return r ? ruleToSlotMinutes(r, DEFAULT_STEP) : DEFAULT_STEP;
  });

  /** Días renderizados (filtrados por la regla si existe). */
  readonly visibleDias = computed<DiaSemana[]>(() => {
    const r = this.rule();
    if (!r) return ALL_DIAS;
    const allowed = new Set(r.allowedDays);
    return ALL_DIAS.filter(d => allowed.has(d));
  });

  /** Celdas originales (vienen del backend, expandidas al paso actual). */
  readonly originalCells = computed<Set<string>>(() => {
    const step = this.step();
    const visible = new Set(this.visibleDias());
    const s = new Set<string>();
    for (const av of this.initial()) {
      if (!av.activo) continue;
      if (!visible.has(av.diaSemana)) continue;
      for (const c of expandToCells(av, step)) s.add(c);
    }
    return s;
  });

  // ── Estado interno (draft) ─────────────────────────────────
  private readonly _draft = signal<Set<string>>(new Set());

  readonly draft = computed(() => this._draft());
  readonly hasChanges = computed(
    () => !setsEqual(this.originalCells(), this._draft()),
  );

  readonly hours = computed<string[]>(() => {
    const out: string[] = [];
    const step = this.step();
    const startMin = this.effectiveStartHour() * 60;
    const endMin = this.effectiveEndHour() * 60;
    for (let m = startMin; m + step <= endMin; m += step) {
      out.push(minToHM(m));
    }
    return out;
  });

  readonly cellsCount = computed(() => this._draft().size);

  /** Total de horas seleccionadas (cellsCount * step / 60). */
  readonly hoursCount = computed(
    () => ((this._draft().size * this.step()) / 60).toFixed(1),
  );

  /**
   * Texto descriptivo del rol y reglas activas para mostrar al usuario
   * (ej. "Dirección · 15 min · Mar y Jue").
   */
  readonly ruleHint = computed<string | null>(() => {
    const r = this.rule();
    if (!r) return null;
    const days = r.allowedDays
      .map(d => DIA_LABEL[d as DiaSemana] ?? d)
      .join(' · ');
    const slotLabel = r.fixedDurationMin
      ? `${r.fixedDurationMin} min`
      : 'duración variable';
    return `${r.label} · ${slotLabel} · ${days}`;
  });

  constructor() {
    // Sincronizar draft cada vez que cambien `initial`, `rule` o `step`.
    effect(() => {
      const original = this.originalCells();
      this._draft.set(new Set(original));
    });
  }

  // ── Acciones ───────────────────────────────────────────────
  isOn(dia: DiaSemana, hour: string): boolean {
    return this._draft().has(cellKey(dia, hour));
  }

  toggle(dia: DiaSemana, hour: string): void {
    if (this.saving()) return;
    const k = cellKey(dia, hour);
    const next = new Set(this._draft());
    if (next.has(k)) next.delete(k);
    else next.add(k);
    this._draft.set(next);
  }

  selectAllDay(dia: DiaSemana): void {
    if (this.saving()) return;
    const next = new Set(this._draft());
    const allOn = this.hours().every(h => next.has(cellKey(dia, h)));
    for (const h of this.hours()) {
      const k = cellKey(dia, h);
      if (allOn) next.delete(k);
      else next.add(k);
    }
    this._draft.set(next);
  }

  clearAll(): void {
    if (this.saving()) return;
    this._draft.set(new Set());
  }

  discard(): void {
    if (this.saving()) return;
    this._draft.set(new Set(this.originalCells()));
    this.cancel.emit();
  }

  submit(): void {
    if (this.saving() || !this.hasChanges()) return;
    const blocks = collapseToBlocks(this._draft(), this.step());
    this.save.emit(blocks);
  }

  // Track-by helpers para la template.
  trackByDia = (_: number, d: DiaSemana): string => d;
  trackByHour = (_: number, h: string): string => h;
}
