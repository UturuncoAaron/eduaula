import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';

export interface AddCourseDialogData {
  seccionId: string;
  periodoId: string;
  seccionNombre: string;
  gradoNombre: string;
}

interface DocenteOption {
  id: string;
  nombre: string;
  apellido_paterno: string;
  especialidad?: string;
}

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
  ],
  templateUrl: './add-course-dialog.html',
  styleUrl: './add-course-dialog.scss',
})
export class AddCourseDialog implements OnInit {
  readonly data: AddCourseDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AddCourseDialog>);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastService);

  docentes = signal<DocenteOption[]>([]);
  saving = signal(false);
  readonly colors = COURSE_COLORS;

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: [''],
    color: ['#3B82F6'],
    docente_id: [null as string | null],
  });

  ngOnInit(): void {
    this.api.get<any>('admin/users/docentes').subscribe({
      next: (r: any) => {
        const lista: DocenteOption[] = (
          r?.data?.data ?? r?.data ?? []
        ) as DocenteOption[];
        this.docentes.set(lista);
      },
      error: () => { },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const v = this.form.value;

    const payload: Record<string, unknown> = {
      nombre: v.nombre!.trim(),
      seccion_id: this.data.seccionId,
      periodo_id: this.data.periodoId,
      color: v.color ?? '#6B7280',
    };

    if (v.descripcion?.trim()) payload['descripcion'] = v.descripcion.trim();
    if (v.docente_id) payload['docente_id'] = v.docente_id;

    this.api.post('courses', payload).subscribe({
      next: (r: any) => {
        this.toastr.success(
          `Curso "${v.nombre}" agregado correctamente`,
          'OK',
          { duration: 3000 },
        );
        this.ref.close(r.data);
      },
      error: (err: any) => {
        this.toastr.error(
          err?.error?.message ?? 'Error al crear el curso',
          'Cerrar',
          { duration: 4000 },
        );
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.ref.close(null);
  }
}