import {
  Component, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CourseSchedule, DiaSemana, DIAS, buildHourTicks, toMinutes,
} from './schedule-editor.types';

export interface SlotAssignData {
  preselectedCursoId: string | null;
  courses: CourseSchedule[];
  dia: DiaSemana;
  horaInicio: string;
  editingSlot?: {
    id: number | string;
    curso_id: string;
    dia_semana: DiaSemana;
    hora_inicio: string;
    hora_fin: string;
    aula: string | null;
  } | null;
}

export interface SlotAssignResult {
  action: 'save' | 'delete';
  curso_id: string;
  dia_semana: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  aula: string | null;
  originalSlotId?: number | string | null;
  originalCursoId?: string | null;
}

interface HourOption {
  value: string;
  blocked: boolean;
  blockedBy: string | null;
}

@Component({
  selector: 'app-slot-assign-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatInputModule, MatFormFieldModule,
    MatTooltipModule, ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="dlg-icon">schedule</mat-icon>
      {{ isEdit() ? 'Editar bloque del horario' : 'Asignar bloque al horario' }}
    </h2>

    <form mat-dialog-content [formGroup]="form" class="dlg-body">

      <mat-form-field appearance="outline" class="w100">
        <mat-label>Curso</mat-label>
        <mat-select formControlName="curso_id">
          @for (c of data.courses; track c.curso_id) {
            <mat-option [value]="c.curso_id">
              <span class="dot" [style.background]="c.color"></span>
              {{ c.curso_nombre }}
            </mat-option>
          }
        </mat-select>
        @if (form.controls.curso_id.invalid && form.controls.curso_id.touched) {
          <mat-error>Seleccioná un curso</mat-error>
        }
      </mat-form-field>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Día</mat-label>
          <mat-select formControlName="dia_semana">
            @for (d of dias; track d.key) {
              <mat-option [value]="d.key">{{ d.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Inicio</mat-label>
          <mat-select formControlName="hora_inicio">
            @for (h of horaInicioOptions(); track h.value) {
              <mat-option [value]="h.value" [disabled]="h.blocked"
                [matTooltip]="h.blocked ? 'Ocupado por ' + h.blockedBy : ''">
                {{ h.value }}
                @if (h.blocked) { <span class="opt-busy">·ocupado</span> }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fin</mat-label>
          <mat-select formControlName="hora_fin">
            @for (h of horaFinOptions(); track h.value) {
              <mat-option [value]="h.value" [disabled]="h.blocked"
                [matTooltip]="h.blocked ? 'Ocupado por ' + h.blockedBy : ''">
                {{ h.value }}
                @if (h.blocked) { <span class="opt-busy">·ocupado</span> }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="w100">
        <mat-label>Aula (opcional)</mat-label>
        <input matInput formControlName="aula" placeholder="Ej: 201 / Laboratorio 2" maxlength="50" />
      </mat-form-field>

      <!-- Banner de conflicto en tiempo real -->
      @if (conflictInfo()) {
        <div class="conflict-banner">
          <mat-icon>warning_amber</mat-icon>
          <span>Conflicto con <strong>{{ conflictInfo()!.curso }}</strong>
            ({{ conflictInfo()!.inicio }}–{{ conflictInfo()!.fin }})</span>
        </div>
      }

      @if (rangeError()) {
        <p class="form-err">
          <mat-icon>error_outline</mat-icon>
          {{ rangeError() }}
        </p>
      }

    </form>

    <div mat-dialog-actions class="dlg-actions">
      @if (isEdit()) {
        <button mat-button color="warn" type="button" (click)="onDelete()">
          <mat-icon>delete_outline</mat-icon> Quitar bloque
        </button>
      }
      <span class="spacer"></span>
      <button mat-button type="button" (click)="onCancel()">Cancelar</button>
      <button mat-flat-button color="primary" type="button"
        [disabled]="form.invalid || !!rangeError() || !!conflictInfo()"
        (click)="onSave()">
        {{ isEdit() ? 'Guardar cambios' : 'Asignar bloque' }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 400px; }
    .dlg-icon { vertical-align: -6px; margin-right: .35rem; color: rgba(0,0,0,.6); }
    .dlg-body { display: flex; flex-direction: column; gap: .25rem; padding-top: .5rem; }
    .w100 { width: 100%; }
    .row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .65rem; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: .4rem; vertical-align: 1px; }
    .opt-busy { font-size: .7rem; color: #ef4444; margin-left: .3rem; }
    .conflict-banner {
      display: flex; align-items: center; gap: .5rem;
      background: #fff7ed; border: 1px solid #fed7aa;
      border-radius: 8px; padding: .6rem .9rem;
      color: #c2410c; font-size: .85rem;
      mat-icon { color: #f97316; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }
    .form-err { display: flex; align-items: center; gap: .35rem; color: #b00020; margin: 0 0 .25rem; font-size: .85rem; }
    .dlg-actions { display: flex; align-items: center; gap: .25rem; }
    .spacer { flex: 1; }
  `],
})
export class SlotAssignDialog {
  readonly data = inject<SlotAssignData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<SlotAssignDialog, SlotAssignResult | null>);
  private readonly fb = inject(FormBuilder);

  readonly dias = DIAS;
  readonly hours = buildHourTicks(7, 18, 15);
  readonly isEdit = computed(() => !!this.data.editingSlot);
  readonly rangeError = signal<string | null>(null);

  readonly form = this.fb.group({
    curso_id: [this.data.editingSlot?.curso_id ?? this.data.preselectedCursoId ?? '', Validators.required],
    dia_semana: [this.data.editingSlot?.dia_semana ?? this.data.dia, Validators.required],
    hora_inicio: [(this.data.editingSlot?.hora_inicio ?? this.data.horaInicio).slice(0, 5), Validators.required],
    hora_fin: [(this.data.editingSlot?.hora_fin ?? this.suggestEnd(this.data.horaInicio)).slice(0, 5), Validators.required],
    aula: [this.data.editingSlot?.aula ?? ''],
  });

  // ── Slots de otros cursos en el día seleccionado (excluye el que se edita) ──
  private otherSlotsForDay = computed(() => {
    const dia = this.form.value.dia_semana as DiaSemana;
    const editId = this.data.editingSlot?.id;
    const result: { curso: string; inicio: string; fin: string }[] = [];
    for (const c of this.data.courses) {
      for (const s of c.slots) {
        if (s.dia_semana !== dia) continue;
        if (s.id === editId) continue;
        result.push({ curso: c.curso_nombre, inicio: s.hora_inicio, fin: s.hora_fin });
      }
    }
    return result;
  });

  // ── Opciones de hora con flag bloqueado ──────────────────────────────────
  readonly horaInicioOptions = computed<HourOption[]>(() => {
    const otros = this.otherSlotsForDay();
    return this.hours.map(h => {
      const hMin = toMinutes(h);
      const clash = otros.find(o => hMin >= toMinutes(o.inicio) && hMin < toMinutes(o.fin));
      return { value: h, blocked: !!clash, blockedBy: clash?.curso ?? null };
    });
  });

  readonly horaFinOptions = computed<HourOption[]>(() => {
    const otros = this.otherSlotsForDay();
    const inicio = this.form.value.hora_inicio;
    return this.hours.map(h => {
      if (inicio && h <= inicio) return { value: h, blocked: false, blockedBy: null };
      const hMin = toMinutes(h);
      const inicioMin = inicio ? toMinutes(inicio) : 0;
      // Fin bloqueado si el rango inicio→h solaparía con otro slot
      const clash = otros.find(o =>
        inicioMin < toMinutes(o.fin) && hMin > toMinutes(o.inicio),
      );
      return { value: h, blocked: !!clash, blockedBy: clash?.curso ?? null };
    });
  });

  // ── Banner de conflicto en tiempo real ───────────────────────────────────
  readonly conflictInfo = computed<{ curso: string; inicio: string; fin: string } | null>(() => {
    const v = this.form.value;
    if (!v.hora_inicio || !v.hora_fin) return null;
    if (toMinutes(v.hora_fin) <= toMinutes(v.hora_inicio)) return null;
    const otros = this.otherSlotsForDay();
    return otros.find(o =>
      toMinutes(v.hora_inicio!) < toMinutes(o.fin) &&
      toMinutes(v.hora_fin!) > toMinutes(o.inicio),
    ) ?? null;
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.validateRange());
    this.validateRange();
  }

  private validateRange(): void {
    const v = this.form.value;
    if (!v.hora_inicio || !v.hora_fin) { this.rangeError.set(null); return; }
    this.rangeError.set(
      toMinutes(v.hora_fin) <= toMinutes(v.hora_inicio)
        ? 'La hora de fin debe ser mayor a la de inicio.'
        : null,
    );
  }

  private suggestEnd(start: string): string {
    const end = toMinutes(start) + 45;
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  }

  onCancel(): void { this.ref.close(null); }

  onSave(): void {
    if (this.form.invalid || this.rangeError() || this.conflictInfo()) return;
    const v = this.form.value;
    this.ref.close({
      action: 'save',
      curso_id: v.curso_id!,
      dia_semana: v.dia_semana! as DiaSemana,
      hora_inicio: v.hora_inicio!,
      hora_fin: v.hora_fin!,
      aula: v.aula?.trim() || null,
      originalSlotId: this.data.editingSlot?.id ?? null,
      originalCursoId: this.data.editingSlot?.curso_id ?? null,
    });
  }

  onDelete(): void {
    if (!this.data.editingSlot) return;
    this.ref.close({
      action: 'delete',
      curso_id: this.data.editingSlot.curso_id,
      dia_semana: this.data.editingSlot.dia_semana,
      hora_inicio: this.data.editingSlot.hora_inicio,
      hora_fin: this.data.editingSlot.hora_fin,
      aula: this.data.editingSlot.aula,
      originalSlotId: this.data.editingSlot.id,
      originalCursoId: this.data.editingSlot.curso_id,
    });
  }
}