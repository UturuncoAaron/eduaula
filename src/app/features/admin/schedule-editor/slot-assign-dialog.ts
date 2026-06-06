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
    <h2 mat-dialog-title class="dialog-title">
      <div class="dialog-title__icon-container">
        <mat-icon>schedule</mat-icon>
      </div>
      <div class="dialog-title__text-group">
        <span class="dialog-title__main">{{ isEdit() ? 'Editar bloque' : 'Asignar nuevo bloque' }}</span>
        <span class="dialog-title__sub">Planificación del horario escolar de la sección</span>
      </div>
    </h2>

    <form mat-dialog-content [formGroup]="form" class="dialog-form">
      <div class="form-section">
        <mat-form-field appearance="outline" class="u-w100">
          <mat-label>Curso o asignatura</mat-label>
          <mat-select formControlName="curso_id">
            @for (c of data.courses; track c.curso_id) {
              <mat-option [value]="c.curso_id">
                <span class="course-indicator" [style.background]="c.color"></span>
                <span class="course-name">{{ c.curso_nombre }}</span>
              </mat-option>
            }
          </mat-select>
          @if (form.controls.curso_id.invalid && form.controls.curso_id.touched) {
            <mat-error>Debes seleccionar una asignatura</mat-error>
          }
        </mat-form-field>
      </div>

      <div class="form-grid">
        <mat-form-field appearance="outline" class="u-w100">
          <mat-label>Día de la semana</mat-label>
          <mat-select formControlName="dia_semana">
            @for (d of dias; track d.key) {
              <mat-option [value]="d.key">{{ d.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="u-w100">
          <mat-label>Hora inicio</mat-label>
          <mat-select formControlName="hora_inicio">
            @for (h of horaInicioOptions(); track h.value) {
              <mat-option [value]="h.value" [disabled]="h.blocked"
                [matTooltip]="h.blocked ? 'Ocupado por ' + h.blockedBy : ''">
                <span class="time-value">{{ h.value }}</span>
                @if (h.blocked) { <span class="status-tag status-tag--busy">Ocupado</span> }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="u-w100">
          <mat-label>Hora fin</mat-label>
          <mat-select formControlName="hora_fin">
            @for (h of horaFinOptions(); track h.value) {
              <mat-option [value]="h.value" [disabled]="h.blocked"
                [matTooltip]="h.blocked ? 'Ocupado por ' + h.blockedBy : ''">
                <span class="time-value">{{ h.value }}</span>
                @if (h.blocked) { <span class="status-tag status-tag--busy">Ocupado</span> }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="form-section">
        <mat-form-field appearance="outline" class="u-w100">
          <mat-label>Aula física / Ambiente educativo (opcional)</mat-label>
          <mat-icon matPrefix class="field-prefix-icon">room</mat-icon>
          <input matInput formControlName="aula" placeholder="Ej: Aula 102, Laboratorio de Física, Auditorio" maxlength="50" />
        </mat-form-field>
      </div>

      @if (conflictInfo()) {
        <div class="alert-message alert-message--conflict">
          <mat-icon class="alert-message__icon">warning</mat-icon>
          <div class="alert-message__content">
            <span class="alert-message__title">Cruce de horario detectado</span>
            <span class="alert-message__desc">Esta franja entra en conflicto directo con <strong>{{ conflictInfo()!.curso }}</strong> ({{ conflictInfo()!.inicio }} – {{ conflictInfo()!.fin }}).</span>
          </div>
        </div>
      }

      @if (rangeError()) {
        <div class="alert-message alert-message--error">
          <mat-icon class="alert-message__icon">error_outline</mat-icon>
          <div class="alert-message__content">
            <span class="alert-message__desc">{{ rangeError() }}</span>
          </div>
        </div>
      }
    </form>

    <div mat-dialog-actions class="dialog-actions">
      @if (isEdit()) {
        <button mat-button color="warn" type="button" class="btn-action btn-action--delete" (click)="onDelete()">
          <mat-icon>delete_outline</mat-icon>
          <span>Eliminar bloque</span>
        </button>
      }
      <span class="u-spacer"></span>
      <button mat-button type="button" class="btn-action btn-action--cancel" (click)="onCancel()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" class="btn-action btn-action--save"
        [disabled]="form.invalid || !!rangeError() || !!conflictInfo()"
        (click)="onSave()">
        <mat-icon>{{ isEdit() ? 'check' : 'add' }}</mat-icon>
        <span>{{ isEdit() ? 'Guardar cambios' : 'Asignar bloque' }}</span>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 520px;
      background: #ffffff;
    }

    .dialog-title {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      margin: 0;
      border-bottom: 1px solid #f1f5f9;

      &__icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background-color: #f0f2ff;
        color: #1a237e;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }

      &__text-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      &__main {
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
        letter-spacing: -0.2px;
      }

      &__sub {
        font-size: 12px;
        font-weight: 400;
        color: #64748b;
      }
    }

    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 24px;
      margin: 0;
      max-height: 65vh;
      overflow-y: auto;
    }

    .form-section {
      width: 100%;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.9fr 0.9fr;
      gap: 12px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }

    .course-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 10px;
      vertical-align: middle;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
    }

    .course-name {
      font-size: 14px;
      font-weight: 500;
      color: #334155;
    }

    .time-value {
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .status-tag {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;

      &--busy {
        background-color: #fef2f2;
        color: #ef4444;
      }
    }

    .field-prefix-icon {
      color: #94a3b8;
      margin-right: 4px;
    }

    .alert-message {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 10px;
      animation: slideDown 0.2s ease-out;

      &__icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      &__content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      &__title {
        font-size: 13px;
        font-weight: 600;
      }

      &__desc {
        font-size: 12px;
        line-height: 1.4;
      }

      &--conflict {
        background-color: #fff7ed;
        border: 1px solid #ffedd5;
        color: #c2410c;
        
        .alert-message__icon { color: #f97316; }
        .alert-message__title { color: #9a3412; }
      }

      &--error {
        background-color: #fef2f2;
        border: 1px solid #fee2e2;
        color: #991b1b;
        align-items: center;
        
        .alert-message__icon { color: #ef4444; }
      }
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      padding: 16px 24px;
      margin: 0;
      border-top: 1px solid #f1f5f9;
      background-color: #f8fafc;
    }

    .btn-action {
      height: 40px !important;
      border-radius: 8px !important;
      font-weight: 600 !important;
      font-size: 13px !important;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &--delete {
        color: #ef4444 !important;
        &:hover { background-color: rgba(239, 68, 68, 0.05); }
      }

      &--cancel {
        color: #64748b !important;
        &:hover { background-color: #e2e8f0; }
      }

      &--save {
        padding: 0 16px !important;
      }
    }

    .u-w100 { width: 100%; }
    .u-spacer { flex: 1; }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class SlotAssignDialog {
  readonly data = inject<SlotAssignData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<SlotAssignDialog, SlotAssignResult | null>);
  private readonly fb = inject(FormBuilder);

  readonly dias = DIAS;
  readonly hours = buildHourTicks(8, 15, 30);
  readonly isEdit = computed(() => !!this.data.editingSlot);
  readonly rangeError = signal<string | null>(null);

  readonly form = this.fb.group({
    curso_id: [this.data.editingSlot?.curso_id ?? this.data.preselectedCursoId ?? '', Validators.required],
    dia_semana: [this.data.editingSlot?.dia_semana ?? this.data.dia, Validators.required],
    hora_inicio: [(this.data.editingSlot?.hora_inicio ?? this.data.horaInicio).slice(0, 5), Validators.required],
    hora_fin: [(this.data.editingSlot?.hora_fin ?? this.suggestEnd(this.data.horaInicio)).slice(0, 5), Validators.required],
    aula: [this.data.editingSlot?.aula ?? ''],
  });

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
      const clash = otros.find(o =>
        inicioMin < toMinutes(o.fin) && hMin > toMinutes(o.inicio),
      );
      return { value: h, blocked: !!clash, blockedBy: clash?.curso ?? null };
    });
  });

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
        ? 'La hora de fin debe ser estrictamente posterior a la hora de inicio.'
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