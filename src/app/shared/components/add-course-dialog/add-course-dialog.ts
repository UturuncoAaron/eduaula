import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api';

export interface AddCourseDialogData {
  seccionId: number;
  periodoId: number;
  seccionNombre: string;
  gradoNombre: string;
}

interface DocenteOption {
  id: string;
  nombre: string;
  apellido_paterno: string;
  especialidad?: string;
}

// Colores predefinidos para el curso
const COURSE_COLORS = [
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Verde', value: '#10B981' },
  { label: 'Morado', value: '#8B5CF6' },
  { label: 'Rojo', value: '#EF4444' },
  { label: 'Naranja', value: '#F97316' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Celeste', value: '#06B6D4' },
  { label: 'Gris', value: '#6B7280' },
];

@Component({
  selector: 'app-add-course-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './add-course-dialog.html',
  styleUrl: './add-course-dialog.scss',
})
export class AddCourseDialog implements OnInit {
  readonly data: AddCourseDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AddCourseDialog>);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  docentes = signal<DocenteOption[]>([]);
  saving = signal(false);
  readonly colors = COURSE_COLORS;

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: [''],
    color: ['#3B82F6'],
    docente_id: [null as string | null],
  });

  ngOnInit() {
    // Cargar docentes para asignación opcional
    this.api.get<DocenteOption[]>('admin/users/docentes').subscribe({
      next: r => this.docentes.set(r.data ?? []),
      error: () => { },
    });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.saving.set(true);
    const v = this.form.value;

    const payload: any = {
      nombre: v.nombre!.trim(),
      seccion_id: this.data.seccionId,
      periodo_id: this.data.periodoId,
      color: v.color ?? '#6B7280',
    };

    if (v.descripcion?.trim()) payload.descripcion = v.descripcion.trim();
    if (v.docente_id) payload.docente_id = v.docente_id;

    this.api.post('courses', payload).subscribe({
      next: (r) => {
        this.snack.open(`Curso "${v.nombre}" agregado correctamente`, 'OK', { duration: 3000 });
        this.ref.close(r.data); // devuelve el curso creado
      },
      error: (err) => {
        this.snack.open(
          err?.error?.message ?? 'Error al crear el curso',
          'Cerrar', { duration: 4000 },
        );
        this.saving.set(false);
      },
    });
  }

  cancel() { this.ref.close(null); }
}