import {
  ChangeDetectionStrategy, Component, computed, input, output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  AccountAvailability, DiaSemana, SetAvailabilityPayload,
} from '../../../core/models/appointments';

const DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const DIA_LABEL: Record<DiaSemana, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb',
};

function pad2(n: number) { return n.toString().padStart(2, '0'); }
function minToHM(m: number) { return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; }
function hmToMin(s: string) { const [h, m] = s.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); }
function cellKey(dia: DiaSemana, hm: string) { return `${dia}|${hm}`; }
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

function expandToCells(av: AccountAvailability): string[] {
  const out: string[] = [];
  const start = hmToMin(av.horaInicio);
  const end = hmToMin(av.horaFin);
  for (let m = start; m < end; m += 30) {
    out.push(cellKey(av.diaSemana, minToHM(m)));
  }
  return out;
}

function collapseToBlocks(cells: Set<string>): SetAvailabilityPayload[] {
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
      if (m === (prev as number) + 30) { prev = m; continue; }
      blocks.push({
        diaSemana: dia as DiaSemana,
        horaInicio: minToHM(runStart),
        horaFin: minToHM((prev as number) + 30),
      });
      runStart = m; prev = m;
    }
    if (runStart !== null) {
      blocks.push({
        diaSemana: dia as DiaSemana,
        horaInicio: minToHM(runStart),
        horaFin: minToHM((prev as number) + 30),
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
  readonly initial = input<AccountAvailability[]>([]);
  readonly startHour = input<number>(7);
  readonly endHour = input<number>(18);
  readonly saving = input<boolean>(false);

  readonly save = output<SetAvailabilityPayload[]>();
  readonly cancel = output<void>();

  readonly DIAS = DIAS;
  readonly DIA_LABEL = DIA_LABEL;

  /** Cells originales (vienen del backend). */
  readonly originalCells = computed<Set<string>>(() => {
    const s = new Set<string>();
    for (const av of this.initial()) {
      if (!av.activo) continue;
      for (const c of expandToCells(av)) s.add(c);
    }
    return s;
  });

  /** Cells del usuario en edición. */
  private readonly _draft = signal<Set<string>>(new Set());

  readonly draft = computed(() => this._draft());
  readonly hasChanges = computed(() => !setsEqual(this.originalCells(), this._draft()));

  readonly hours = computed(() => {
    const out: string[] = [];
    for (let h = this.startHour(); h < this.endHour(); h++) {
      out.push(`${pad2(h)}:00`);
      out.push(`${pad2(h)}:30`);
    }
    return out;
  });

  readonly cellsCount = computed(() => this._draft().size);
  readonly hoursCount = computed(() => (this._draft().size * 0.5).toFixed(1));

  constructor() {
    // Reset draft cuando cambia el `initial` (carga inicial / reload).
    this.syncDraftFromInitial();
  }

  ngOnChanges(): void {
    this.syncDraftFromInitial();
  }

  private syncDraftFromInitial(): void {
    const next = new Set<string>(this.originalCells());
    this._draft.set(next);
  }

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
    this.syncDraftFromInitial();
    this.cancel.emit();
  }

  submit(): void {
    if (this.saving() || !this.hasChanges()) return;
    const blocks = collapseToBlocks(this._draft());
    this.save.emit(blocks);
  }
}