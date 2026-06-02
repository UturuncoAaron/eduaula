import {
  ChangeDetectionStrategy, Component, computed, input, output, signal, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

import {
  AccountAvailability, AppointmentRoleRule, DiaSemana,
  SetAvailabilityPayload, WeekAppointmentSummary,
  ruleToStartHour, ruleToEndHour,
} from '../../../core/models/appointments';
import { WeekGrid } from '../week-grid/week-grid';
import {
  WeekDia,
  WeekGridCellClick,
  WeekSlot,
  isWeekDia,
  toHHMM,
  toMin,
} from '../week-grid/week-grid.types';

const ALL_DIAS: DiaSemana[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes',
];
const DIA_LABEL: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
};

/** Fallback cuando no hay regla de rol configurada. */
const DEFAULT_BLOCK_MIN = 30;

function cellKey(dia: DiaSemana, m: number) { return `${dia}|${m}`; }
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/** Expande un bloque de disponibilidad a celdas individuales (minuto inicial). */
function expandToCells(av: AccountAvailability, step: number): string[] {
  const out: string[] = [];
  const start = toMin(av.horaInicio);
  const end = toMin(av.horaFin);
  for (let m = start; m + step <= end; m += step) {
    out.push(cellKey(av.diaSemana, m));
  }
  return out;
}

/** Colapsa el set de celdas (minuto inicial) en bloques contiguos. */
function collapseToBlocks(cells: Set<string>, step: number): SetAvailabilityPayload[] {
  const byDay: Record<string, number[]> = {};
  for (const k of cells) {
    const [dia, mStr] = k.split('|');
    (byDay[dia] ??= []).push(Number(mStr));
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
        horaInicio: toHHMM(runStart),
        horaFin: toHHMM((prev as number) + step),
      });
      runStart = m; prev = m;
    }
    if (runStart !== null) {
      blocks.push({
        diaSemana: dia as DiaSemana,
        horaInicio: toHHMM(runStart),
        horaFin: toHHMM((prev as number) + step),
      });
    }
  }
  return blocks;
}

/** Interfaz del modal de horario personalizado. */
export interface CustomSlotForm {
  dia: DiaSemana;
  horaInicio: string; // "HH:mm"
}

@Component({
  selector: 'app-availability-calendar-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    WeekGrid,
  ],
  templateUrl: './availability-calendar-editor.html',
  styleUrl: './availability-calendar-editor.scss',
})
export class AvailabilityCalendarEditor {
  // ── Inputs ─────────────────────────────────────────────────
  readonly initial = input<AccountAvailability[]>([]);
  readonly saving = input<boolean>(false);
  /**
   * Regla del rol que se está configurando. Si está presente, define las
   * cotas duras (horas y días permitidos). Sin regla el editor cae a
   * 07:00–18:00 L–V (modo legacy).
   * El tamaño del bloque viene de `rule.availabilityBlockMin`.
   */
  readonly rule = input<AppointmentRoleRule | null>(null);

  // Override manual cuando no se quiere usar el rule (legacy).
  readonly startHour = input<number | null>(null);
  readonly endHour = input<number | null>(null);

  /**
   * Citas de seguimiento de la semana — se renderizan como slots especiales
   * "ocupados" con badge morado en la grilla, para que la psicóloga sepa
   * que ese horario ya tiene una cita de seguimiento programada.
   */
  readonly weekFollowUps = input<WeekAppointmentSummary[]>([]);

  // ── Outputs ────────────────────────────────────────────────
  readonly save = output<SetAvailabilityPayload[]>();
  readonly cancel = output<void>();
  /**
   * Emite el AccountAvailability completo (con id real del servidor) cuando
   * el usuario quiere eliminar un único bloque. El padre debe llamar al
   * endpoint `DELETE /availability/slot/:id` y gestionar la cascada 409.
   */
  readonly deleteSlot = output<AccountAvailability>();

  // ── Estado del modal de horario personalizado ──────────────
  readonly showCustomModal = signal(false);
  readonly customDia = signal<DiaSemana>('lunes');
  readonly customHoraInicio = signal<string>('07:00');
  readonly customHoraError = signal<string | null>(null);

  /** Hora de fin calculada (inicio + step) para mostrar en el hint. */
  readonly customBlockEnd = computed<string>(() => {
    const hora = this.customHoraInicio();
    if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) return '—';
    return toHHMM(toMin(hora) + this.step());
  });

  // ── Computed: cotas + días ──────────────────────────────────
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

  /**
   * Tamaño del bloque de disponibilidad según el rol:
   * - docente  → 45 min (3 sub-slots de 15 min, hasta 3 padres por bloque)
   * - admin    → 15 min (slot indivisible, 1 padre por slot)
   * - psicóloga → 30 min
   * Usa la propiedad `availabilityBlockMin` de la regla del rol.
   */
  readonly step = computed<number>(() => {
    const r = this.rule();
    return r?.availabilityBlockMin ?? DEFAULT_BLOCK_MIN;
  });

  /** Días renderizados (filtrados por la regla si existe). */
  readonly visibleDias = computed<DiaSemana[]>(() => {
    const r = this.rule();
    if (!r) return ALL_DIAS;
    const allowed = new Set(r.allowedDays);
    return ALL_DIAS.filter(d => allowed.has(d));
  });

  /** Para pasar al week-grid como `allowedDays`. */
  readonly allowedWeekDays = computed<readonly WeekDia[]>(() =>
    this.visibleDias().filter(isWeekDia),
  );

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

  readonly cellsCount = computed(() => this._draft().size);

  /**
   * Bloques guardados en el servidor agrupados por día y ordenados, para
   * el panel de "Eliminar bloques" (un botón por bloque con cascada).
   * Excluye días que la regla actual no permite.
   */
  readonly savedSlots = computed<AccountAvailability[]>(() => {
    const visible = new Set(this.visibleDias());
    return this.initial()
      .filter(av => av.activo && visible.has(av.diaSemana))
      .sort((a, b) => {
        const di = ALL_DIAS.indexOf(a.diaSemana) - ALL_DIAS.indexOf(b.diaSemana);
        if (di !== 0) return di;
        return toMin(a.horaInicio) - toMin(b.horaInicio);
      });
  });

  /** Opciones de días para el selector del modal. */
  readonly diasOptions = computed<{ value: DiaSemana; label: string }[]>(() =>
    this.visibleDias().map(d => ({ value: d, label: DIA_LABEL[d] ?? d })),
  );

  diaLabel(d: DiaSemana): string { return DIA_LABEL[d] ?? d; }

  emitDeleteSlot(av: AccountAvailability): void {
    if (this.saving()) return;
    this.deleteSlot.emit(av);
  }

  /** Total de horas seleccionadas. */
  readonly hoursCount = computed(
    () => ((this._draft().size * this.step()) / 60).toFixed(1),
  );

  /** WeekSlot[] para el week-grid — colapsados a franjas contiguas. */
  readonly draftSlots = computed<WeekSlot[]>(() => {
    const blocks = collapseToBlocks(this._draft(), this.step());
    const draft = blocks.map<WeekSlot>((b, i) => ({
      id: `draft-${b.diaSemana}-${b.horaInicio}-${i}`,
      dia: b.diaSemana,
      horaInicio: b.horaInicio,
      horaFin: b.horaFin,
      title: 'Disponible',
      kind: 'available',
    }));

    // Añadir citas de seguimiento como slots ocupados con badge especial
    const DIAS_MAP: Record<number, WeekDia> = {
      1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado',
    };
    const followUpSlots: WeekSlot[] = this.weekFollowUps()
      .filter(f => f.estado === 'pendiente' || f.estado === 'confirmada')
      .flatMap((f, i): WeekSlot[] => {
        const d = new Date(f.scheduledAt);
        const dia = DIAS_MAP[d.getDay()];
        if (!dia) return [];
        const startMin = d.getHours() * 60 + d.getMinutes();
        return [{
          id: `followup-${f.id}-${i}`,
          dia,
          horaInicio: toHHMM(startMin),
          horaFin: toHHMM(startMin + f.durationMin),
          title: `Seguimiento${f.studentName ? `: ${f.studentName}` : ''}`,
          kind: 'taken' as const,
          color: '#7c3aed',
        }];
      });

    return [...draft, ...followUpSlots];
  });

  /**
   * Texto descriptivo del rol y reglas activas para mostrar al usuario.
   */
  readonly ruleHint = computed<string | null>(() => {
    const r = this.rule();
    if (!r) return null;
    const days = r.allowedDays
      .map(d => DIA_LABEL[d as DiaSemana] ?? d)
      .join(' · ');
    const blockMin = r.availabilityBlockMin ?? DEFAULT_BLOCK_MIN;
    // Para el docente: aclarar que cada bloque de 45 min admite hasta 3 padres
    const blockLabel = r.role === 'docente'
      ? `Bloques de ${blockMin} min (hasta 3 padres/bloque)`
      : `Bloques de ${blockMin} min`;
    return `${r.label} · ${blockLabel} · ${days}`;
  });

  constructor() {
    // Sincronizar draft cada vez que cambien `initial`, `rule` o `step`.
    effect(() => {
      const original = this.originalCells();
      this._draft.set(new Set(original));
    });
  }

  // ── Acciones de la grilla ───────────────────────────────────
  onCellClick(ev: WeekGridCellClick): void {
    if (this.saving()) return;
    const m = toMin(ev.hora);
    const next = new Set(this._draft());
    const k = cellKey(ev.dia, m);
    if (next.has(k)) next.delete(k);
    else next.add(k);
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

  // ── Modal de horario personalizado ─────────────────────────
  openCustomModal(): void {
    if (this.saving()) return;
    // Resetear al primer día visible y hora por defecto
    const firstDia = this.visibleDias()[0] ?? 'lunes';
    this.customDia.set(firstDia);
    this.customHoraInicio.set(`${String(this.effectiveStartHour()).padStart(2, '0')}:00`);
    this.customHoraError.set(null);
    this.showCustomModal.set(true);
  }

  closeCustomModal(): void {
    this.showCustomModal.set(false);
    this.customHoraError.set(null);
  }

  confirmCustomSlot(): void {
    const dia = this.customDia();
    const horaStr = this.customHoraInicio();

    // Validar formato HH:mm
    if (!/^\d{1,2}:\d{2}$/.test(horaStr)) {
      this.customHoraError.set('Formato inválido. Usa HH:MM (ej. 07:30)');
      return;
    }

    const startMin = toMin(horaStr);
    const endMin = startMin + this.step();
    const startHourMin = this.effectiveStartHour() * 60;
    const endHourMin = this.effectiveEndHour() * 60;

    if (startMin < startHourMin) {
      this.customHoraError.set(
        `La hora mínima es ${toHHMM(startHourMin)}`
      );
      return;
    }
    if (endMin > endHourMin) {
      this.customHoraError.set(
        `El bloque terminaría a las ${toHHMM(endMin)}, fuera del horario permitido (hasta ${toHHMM(endHourMin)})`
      );
      return;
    }

    // Agregar la celda al draft
    const k = cellKey(dia, startMin);
    const next = new Set(this._draft());
    next.add(k);
    this._draft.set(next);

    this.closeCustomModal();
  }
}
