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

interface ColorOption {
  label: string;
  value: string;
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
  colors = signal<ColorOption[]>([]);
  saving = signal(false);

  form = this.fb.group({
    catalogo_id: ['' as string, Validators.required],
    descripcion: [''],
    color: ['#1976d2', Validators.required],
    docente_id: [null as string | null],
  });

  ngOnInit(): void {
    forkJoin({
      catalogo: this.api.get<any>('courses/catalog'),
      docentes: this.api.get<any>('admin/users/docentes'),
      colors: this.api.get<any>('courses/colors'),
    }).subscribe({
      next: ({ catalogo, docentes, colors }) => {
        this.catalogo.set(catalogo?.data ?? []);
        this.docentes.set(docentes?.data?.data ?? docentes?.data ?? []);

        const paleta: ColorOption[] = colors?.data ?? [];
        this.colors.set(paleta);
        if (paleta.length) this.form.patchValue({ color: paleta[0].value });
      },
      error: () => this.toastr.error('Error al cargar datos del formulario', 'Cerrar'),
    });

    // Cuando cambia el curso del catálogo, heredar su color por defecto
    this.form.controls.catalogo_id.valueChanges.subscribe(id => {
      const item = this.catalogo().find(c => c.id === id);
      if (item) this.form.patchValue({ color: item.color }, { emitEvent: false });
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

    const payload: Record<string, unknown> = {
      catalogo_id: v.catalogo_id,
      seccion_id: this.data.seccionId,
      anio: this.data.anio,
      color: v.color,
    };
    if (v.descripcion?.trim()) payload['descripcion'] = v.descripcion.trim();
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