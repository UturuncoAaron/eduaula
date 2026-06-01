import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CourseDataService } from '../../../core/services/course-data'; // Tu nuevo servicio
import { ToastService } from 'ngx-toastr-notifier';
import type { CourseCatalog } from '../../../core/models/course';

export interface CourseCatalogFormData {
  mode: 'create' | 'edit';
  item?: CourseCatalog;
}

interface ColorOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-course-catalog-form-dialog',
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
  templateUrl: './course-catalog-form-dialog.html',
  styleUrl: './course-catalog-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseCatalogFormDialog implements OnInit {
  readonly data = inject<CourseCatalogFormData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<CourseCatalogFormDialog>);
  private readonly fb = inject(FormBuilder);
  private readonly courseData = inject(CourseDataService); // Inyectamos el servicio con caché
  private readonly toastr = inject(ToastService);

  readonly saving = signal(false);

  readonly areasCurriculares = signal<string[]>([]);
  readonly coloresSugeridos = signal<ColorOption[]>([]);

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    area: [null as string | null],
    color: ['', [Validators.required]],
  });

  ngOnInit(): void {
    // forkJoin ahora consume streams cacheables. Si ya se llamaron antes, responden en 0 milisegundos.
    forkJoin({
      colores: this.courseData.getAvailableColors().pipe(catchError(() => of([]))),
      areas: this.courseData.getAvailableAreas().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ colores, areas }) => {
        this.coloresSugeridos.set(colores);
        this.areasCurriculares.set(areas);

        if (this.data.mode === 'create' && colores.length > 0) {
          this.form.patchValue({ color: colores[0].value });
        }
      },
      error: () => this.toastr.error('Error al sincronizar los catálogos del servidor', 'Cerrar')
    });

    if (this.data.mode === 'edit' && this.data.item) {
      this.form.patchValue({
        nombre: this.data.item.nombre,
        area: this.data.item.area ?? null,
        color: this.data.item.color,
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValues = this.form.value;
    const payload = {
      ...formValues,
      nombre: formValues.nombre?.trim(),
      area: formValues.area ?? null
    };

    this.ref.close(payload);
  }

  cancel(): void {
    this.ref.close(null);
  }
}