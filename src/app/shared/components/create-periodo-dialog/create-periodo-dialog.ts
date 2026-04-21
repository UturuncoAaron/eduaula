import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-create-periodo-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './create-periodo-dialog.html',
  styleUrl: './create-periodo-dialog.scss',
})
export class CreatePeriodoDialog {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<CreatePeriodoDialog>);

  saving = signal(false);

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    anio: [new Date().getFullYear(), [Validators.required, Validators.min(2020)]],
    bimestre: [1, [Validators.required]],
    fecha_inicio: ['', [Validators.required]],
    fecha_fin: ['', [Validators.required]],
  });

  bimestres = [
    { value: 1, label: '1° Bimestre' },
    { value: 2, label: '2° Bimestre' },
    { value: 3, label: '3° Bimestre' },
    { value: 4, label: '4° Bimestre' },
  ];

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.dialogRef.close(this.form.value);
  }

  cancel() {
    this.dialogRef.close(null);
  }
}