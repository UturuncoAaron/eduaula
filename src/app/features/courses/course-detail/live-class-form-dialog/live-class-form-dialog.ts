import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { CourseService } from '../../stores/course';
import { LiveClass } from '../../../../core/models/course';

export interface LiveClassFormDialogData {
  courseId: string;
  liveClass?: LiveClass;
}

@Component({
  selector: 'app-live-class-form-dialog',
  imports: [
    ReactiveFormsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatDialogModule,
  ],
  templateUrl: './live-class-form-dialog.html',
  styleUrl: './live-class-form-dialog.scss',
})
export class LiveClassFormDialog {
  private fb = inject(FormBuilder);
  private csSvc = inject(CourseService);
  private snack = inject(MatSnackBar);
  private ref = inject<MatDialogRef<LiveClassFormDialog>>(MatDialogRef);
  readonly data = inject<LiveClassFormDialogData>(MAT_DIALOG_DATA);

  loading = signal(false);
  isEdit = !!this.data.liveClass;

  form = this.fb.group({
    titulo: [this.data.liveClass?.titulo ?? '', [Validators.required, Validators.minLength(3)]],
    descripcion: [this.data.liveClass?.descripcion ?? ''],
    fecha_hora: [this.toLocalInput(this.data.liveClass?.fecha_hora), Validators.required],
    duracion_min: [this.data.liveClass?.duracion_min ?? 60, [Validators.required, Validators.min(10)]],
    link_reunion: [this.data.liveClass?.link_reunion ?? '', [Validators.required, Validators.pattern('https?://.+')]],
  });

  private toLocalInput(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  submit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);

    const v = this.form.value;
    const body = {
      titulo: v.titulo!,
      descripcion: v.descripcion ?? undefined,
      fecha_hora: new Date(v.fecha_hora!).toISOString(),
      duracion_min: v.duracion_min!,
      link_reunion: v.link_reunion!,
    };

    const obs = this.isEdit
      ? this.csSvc.updateLiveClass(this.data.liveClass!.id, body)
      : this.csSvc.createLiveClass(this.data.courseId, body);

    obs.subscribe({
      next: res => {
        this.snack.open(
          this.isEdit ? 'Videoconferencia actualizada' : 'Videoconferencia programada',
          'OK', { duration: 3000 },
        );
        this.ref.close(res.data);
      },
      error: err => {
        const msg = err?.error?.message ?? 'No se pudo guardar';
        this.snack.open(msg, 'Cerrar', { duration: 4000 });
        this.loading.set(false);
      },
    });
  }

  cerrar() { this.ref.close(); }
}
