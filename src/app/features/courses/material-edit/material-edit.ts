import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CourseService } from '../stores/course';
import { Material, TipoMaterial } from '../../../core/models/course';

export interface MaterialEditData {
  courseId: string;
  material: Material;
}

@Component({
  selector: 'app-material-edit',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './material-edit.html',
  styleUrl: './material-edit.scss',
})
export class MaterialEdit {
  private fb = inject(FormBuilder);
  private csSvc = inject(CourseService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<MaterialEdit>);
  private data = inject<MaterialEditData>(MAT_DIALOG_DATA);

  readonly bimestres = [1, 2, 3, 4];
  readonly semanas = Array.from({ length: 20 }, (_, i) => i + 1);

  loading = signal(false);
  esArchivo = !!(this.data.material.storage_key
    || (this.data.material.url && !this.data.material.url.startsWith('http')));

  form = this.fb.group({
    titulo: [this.data.material.titulo, [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    tipo: [this.data.material.tipo as TipoMaterial, Validators.required],
    url: [this.data.material.url ?? ''],
    descripcion: [this.data.material.descripcion ?? '', Validators.maxLength(500)],
    bimestre: [this.data.material.bimestre ?? null],
    semana: [this.data.material.semana ?? null],
  });

  cancelar() {
    this.dialogRef.close(false);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const v = this.form.value;
    const body: Partial<Material> = {
      titulo: v.titulo!,
      tipo: v.tipo!,
      descripcion: v.descripcion ?? null,
      bimestre: v.bimestre ?? null,
      semana: v.semana ?? null,
    };
    if (!this.esArchivo && v.url) body.url = v.url;

    this.csSvc.updateMaterial(this.data.courseId, this.data.material.id, body).subscribe({
      next: () => {
        this.snack.open('Material actualizado', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = (err as { error?: { message?: string } })?.error?.message
          ?? 'No se pudo actualizar el material';
        this.snack.open(msg, 'Cerrar', { duration: 4000 });
      },
    });
  }
}
