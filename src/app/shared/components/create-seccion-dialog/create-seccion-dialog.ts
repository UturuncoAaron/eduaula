import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface SeccionDialogData {
  gradoId: number;
  gradoNombre: string;
  // ── Solo para editar ──
  seccionId?: number;
  nombre?: string;
  capacidad?: number;
  alumnosActuales?: number;
}

@Component({
  selector: 'app-create-seccion-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './create-seccion-dialog.html',
  styleUrl: './create-seccion-dialog.scss',
})
export class CreateSeccionDialog {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<CreateSeccionDialog>);
  readonly data = inject<SeccionDialogData>(MAT_DIALOG_DATA);

  saving = signal(false);

  /** true cuando se pasa seccionId → modo editar */
  readonly isEdit = !!this.data.seccionId;

  form = this.fb.group({
    nombre: [
      this.data.nombre ?? '',
      [Validators.required, Validators.maxLength(10)],
    ],
    capacidad: [
      this.data.capacidad ?? 35,
      [
        Validators.required,
        Validators.min(this.isEdit ? (this.data.alumnosActuales ?? 1) : 1),
        Validators.max(60),
      ],
    ],
  });

  /** En modo editar: solo habilita "Guardar" si hay cambios */
  hasChanges(): boolean {
    if (!this.isEdit) return true;
    const v = this.form.value;
    return v.nombre !== this.data.nombre || v.capacidad !== this.data.capacidad;
  }

  /** Preview de barra de capacidad (solo en modo editar) */
  getCapPreviewPercent(): number {
    const cap = this.form.get('capacidad')?.value ?? 1;
    if (cap <= 0) return 0;
    return Math.min(Math.round(((this.data.alumnosActuales ?? 0) / cap) * 100), 100);
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.dialogRef.close({
      nombre: this.form.value.nombre!.trim().toUpperCase(),
      capacidad: this.form.value.capacidad!,
    });
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
