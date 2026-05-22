import {
  Component, inject, signal, OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { CourseCatalog } from '../../../core/models/course';

export const AREAS = [
  'Comunicación', 'Matemática', 'Ciencias Sociales',
  'Ciencia y Tecnología', 'Inglés', 'Arte y Cultura',
  'Educación Física', 'Educación Religiosa', 'Tutoría', 'Otro',
];

export const COLORES = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#c62828', '#00838f', '#558b2f', '#4527a0',
  '#2e7d32', '#1565c0', '#6d4c41', '#37474f',
];

export interface CourseCatalogFormData {
  mode: 'create' | 'edit';
  item?: CourseCatalog;
}

@Component({
  selector: 'app-course-catalog-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
  ],
  templateUrl: './course-catalog-form-dialog.html',
  styleUrl: './course-catalog-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseCatalogFormDialog implements OnInit {
  readonly data = inject<CourseCatalogFormData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<CourseCatalogFormDialog>);
  private fb = inject(FormBuilder);

  saving = signal(false);
  readonly areas = AREAS;
  readonly colores = COLORES;

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    area: [null as string | null],
    color: ['#1976d2'],
  });

  ngOnInit(): void {
    if (this.data.mode === 'edit' && this.data.item) {
      this.form.patchValue({
        nombre: this.data.item.nombre,
        area: this.data.item.area ?? null,
        color: this.data.item.color,
      });
    }
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.ref.close(this.form.value);
  }

  cancel(): void { this.ref.close(null); }
}