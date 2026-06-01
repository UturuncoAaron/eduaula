import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { ToastService } from 'ngx-toastr-notifier';
import { ApiService } from '../../../core/services/api';
import { CourseCatalog } from '../../../core/models/course';

export interface AddCourseDialogData {
  seccionId: string;
  anio: number;
  seccionNombre: string;
  gradoNombre: string;
}

interface DocenteOption {
  id: string;
  nombre: string;
  apellido_paterno: string;
  especialidad?: string;
}

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCourseDialog implements OnInit {
  readonly data: AddCourseDialogData = inject(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AddCourseDialog>);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastService);

  catalogo = signal<CourseCatalog[]>([]);
  docentes = signal<DocenteOption[]>([]);
  saving = signal(false);

  form = this.fb.group({
    catalogo_id: ['', Validators.required],
    descripcion: [null as string | null], // Inicializado en null por defecto
    docente_id: [null as string | null],
  });

  ngOnInit(): void {
    // Ya no consultamos la paleta de colores del backend, ahorrando un request redundante
    forkJoin({
      catalogo: this.api.get<any>('courses/catalog'),
      docentes: this.api.get<any>('admin/users/docentes'),
    }).subscribe({
      next: ({ catalogo, docentes }) => {
        this.catalogo.set(catalogo?.data ?? []);
        this.docentes.set(docentes?.data?.data ?? docentes?.data ?? []);
      },
      error: () => this.toastr.error('Error al cargar datos del formulario', 'Cerrar'),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const v = this.form.value;
    const cursoNombre = this.catalogo().find(c => c.id === v.catalogo_id)?.nombre ?? '';

    // Estructura del payload ideal para el endpoint POST de NestJS
    const payload: Record<string, unknown> = {
      catalogo_id: v.catalogo_id,
      seccion_id: this.data.seccionId,
      anio: this.data.anio,
      descripcion: v.descripcion?.trim() || null, // Se envía null si el usuario no ingresó nada
    };

    if (v.docente_id) payload['docente_id'] = v.docente_id;

    this.api.post('courses', payload).subscribe({
      next: (r: any) => {
        this.toastr.success(`Curso "${cursoNombre}" agregado correctamente`, 'OK', { duration: 3000 });
        this.ref.close(r.data);
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message ?? 'Error al crear el curso', 'Cerrar', { duration: 4000 });
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    this.ref.close(null);
  }
}