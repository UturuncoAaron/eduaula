import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface CreateSeccionData {
  gradoId: number;
  gradoNombre: string;
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
  readonly data = inject<CreateSeccionData>(MAT_DIALOG_DATA);

  saving = signal(false);

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(10)]],
    capacidad: [35, [Validators.required, Validators.min(1), Validators.max(50)]],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    // Devuelve los valores — el padre hace la llamada API
    this.dialogRef.close({
      nombre: this.form.value.nombre!.trim().toUpperCase(),
      capacidad: this.form.value.capacidad!,
    });
  }

  cancel() {
    this.dialogRef.close(null);
  }
}