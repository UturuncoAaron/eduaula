import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-task-create',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './task-create.html',
  styleUrl: './task-create.scss',
})
export class TaskCreate {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<TaskCreate>);
  private courseId = inject<string>(MAT_DIALOG_DATA);

  loading = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_entrega: [null, Validators.required],
    hora_entrega: ['23:59', Validators.required],
    puntos_max: [20, [Validators.required, Validators.min(1), Validators.max(20)]],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);

    // combinar fecha + hora en ISO string
    const fecha = this.form.value.fecha_entrega as unknown as Date;
    const [h, m] = (this.form.value.hora_entrega as string).split(':');
    fecha.setHours(+h, +m, 0, 0);

    const payload = {
      titulo: this.form.value.titulo,
      descripcion: this.form.value.descripcion,
      fecha_entrega: fecha.toISOString(),
      puntos_max: this.form.value.puntos_max,
    };

    this.api.post(`courses/${this.courseId}/tasks`, payload).subscribe({
      next: () => {
        this.snack.open('Tarea creada correctamente', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snack.open('Error al crear la tarea', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}