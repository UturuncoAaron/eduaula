import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-create-periodo-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatDatepickerModule, MatProgressSpinnerModule,
  ],
  templateUrl: './create-periodo-dialog.html',
  styleUrl: './create-periodo-dialog.scss',
})
export class CreatePeriodoDialog {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<CreatePeriodoDialog>);
  private data = inject<{ anio: number }>(MAT_DIALOG_DATA, { optional: true });

  submitting = signal(false);

  form = this.fb.group({
    nombre: ['', Validators.required],
    anio: [this.data?.anio ?? new Date().getFullYear(), Validators.required],
    bimestre: [1, Validators.required],
    fecha_inicio: [null as Date | null, Validators.required],
    fecha_fin: [null as Date | null, Validators.required],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    this.dialogRef.close({
      nombre: v.nombre,
      anio: v.anio,
      bimestre: v.bimestre,
      fecha_inicio: this.formatDate(v.fecha_inicio!),
      fecha_fin: this.formatDate(v.fecha_fin!),
    });
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onCancel(): void { this.dialogRef.close(null); }
}