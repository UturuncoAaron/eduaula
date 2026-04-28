import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api';
import { Course } from '../../../core/models/course';
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
export class TaskCreate implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private router = inject(Router);
  private location = inject(Location);
  private dialogRef = inject(MatDialogRef<TaskCreate>, { optional: true });
  private dialogData = inject<string | null>(MAT_DIALOG_DATA, { optional: true });

  loading = signal(false);
  courses = signal<Course[]>([]);

  form = this.fb.group({
    curso_id: ['', Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    fecha_entrega: [null, Validators.required],
    hora_entrega: ['23:59', Validators.required],
    puntos_max: [20, [Validators.required, Validators.min(1), Validators.max(20)]],
  });

  ngOnInit() {
    if (this.dialogData) {
      this.form.patchValue({ curso_id: this.dialogData });
    } else {
      this.api.get<Course[]>('courses').subscribe({
        next: r => this.courses.set(r.data),
        error: () => this.courses.set([]),
      });
    }
  }

  get isDialog(): boolean { return !!this.dialogRef; }

  cancel() {
    if (this.dialogRef) this.dialogRef.close(false);
    else this.location.back();
  }

  submit() {
    if (this.loading()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);

    // combinar fecha + hora en ISO string
    const fecha = this.form.value.fecha_entrega as unknown as Date;
    const [h, m] = (this.form.value.hora_entrega as string).split(':');
    fecha.setHours(+h, +m, 0, 0);

    const descripcion = (this.form.value.descripcion ?? '').trim();
    const payload: Record<string, unknown> = {
      titulo: this.form.value.titulo,
      fecha_limite: fecha.toISOString(),
      puntos_max: this.form.value.puntos_max,
      permite_archivo: true,
      permite_texto: true,
    };
    if (descripcion) payload['instrucciones'] = descripcion;

    const cursoId = this.dialogData ?? this.form.value.curso_id ?? '';
    this.api.post(`courses/${cursoId}/tasks`, payload).subscribe({
      next: () => {
        this.snack.open('Tarea creada correctamente', 'OK', { duration: 3000 });
        if (this.dialogRef) this.dialogRef.close(true);
        else this.router.navigate(['/tareas']);
      },
      error: () => {
        this.snack.open('Error al crear la tarea', 'OK', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}
