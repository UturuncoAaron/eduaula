import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
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
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './create-periodo-dialog.html',
  styleUrl: './create-periodo-dialog.scss',
})
export class CreatePeriodoDialog {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<CreatePeriodoDialog>);

  submitting = signal(false);

  form = this.fb.group({
    nombre: ['', Validators.required],
    anio: [new Date().getFullYear(), Validators.required],
    bimestre: [1, Validators.required],
    fecha_inicio: [null as Date | null, Validators.required],
    fecha_fin: [null as Date | null, Validators.required],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.value);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
