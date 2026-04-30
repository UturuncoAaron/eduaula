import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from 'ngx-toastr-notifier';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api';

export interface ForumCreateData {
  courseId: string;
  bimestre?: number | null;
  semana?: number | null;
}

@Component({
  selector: 'app-forum-create',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './forum-create.html',
  styleUrl: './forum-create.scss',
})
export class ForumCreate {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toastr = inject(ToastService);
  private dialogRef = inject(MatDialogRef<ForumCreate>);
  private dialogData = inject<string | ForumCreateData>(MAT_DIALOG_DATA);

  private get courseId(): string {
    return typeof this.dialogData === 'string' ? this.dialogData : this.dialogData.courseId;
  }

  private get defaultBimestre(): number | null {
    return typeof this.dialogData === 'string' ? null : this.dialogData.bimestre ?? null;
  }

  private get defaultSemana(): number | null {
    return typeof this.dialogData === 'string' ? null : this.dialogData.semana ?? null;
  }

  readonly bimestres = [1, 2, 3, 4];
  readonly semanas = Array.from({ length: 16 }, (_, i) => i + 1);

  loading = signal(false);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    descripcion: [''],
    bimestre: [this.defaultBimestre as number | null],
    semana: [this.defaultSemana as number | null],
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const v = this.form.value;
    const payload = {
      titulo: v.titulo,
      descripcion: v.descripcion,
      bimestre: v.bimestre ?? null,
      semana: v.semana ?? null,
    };
    this.api.post(`courses/${this.courseId}/forums`, payload).subscribe({
      next: () => {
        this.toastr.success('Foro creado correctamente', 'Éxito');
        this.dialogRef.close(true);
      },
      error: () => {
        this.toastr.success('Error al crear el foro', 'Éxito');
        this.loading.set(false);
      },
    });
  }
}
