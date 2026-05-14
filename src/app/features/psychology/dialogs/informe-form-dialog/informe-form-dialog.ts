import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import {
  FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import {
  InformePsicologico, InformeTipo, INFORME_TIPO_LABELS,
} from '../../../../core/models/psychology';

export interface InformeFormDialogData {
  studentId: string;
  studentName: string;
  /** Si viene, el dialog está en modo edición. */
  informe?: InformePsicologico;
}

/**
 * Dialog para crear / editar un informe psicológico.
 *
 * Bloquea edición si el informe está `finalizado` (inmutabilidad
 * garantizada en backend, pero protegemos también el flujo UX).
 *
 * `tipo` distingue evaluación, seguimiento, derivación a familia
 * (genera PDF amigable para los padres) y derivación externa
 * (PDF orientado a especialista). El frontend lleva el label legible
 * desde `INFORME_TIPO_LABELS`.
 */
@Component({
  selector: 'app-informe-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './informe-form-dialog.html',
  styleUrl: './informe-form-dialog.scss',
})
export class InformeFormDialog {
  readonly data: InformeFormDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<InformeFormDialog>);
  private fb = inject(FormBuilder);
  private store = inject(PsychologyStore);
  private toastr = inject(ToastService);

  loading = signal(false);
  errorMsg = signal('');

  readonly isEdit = computed(() => !!this.data.informe);
  readonly isLocked = computed(() => this.data.informe?.estado === 'finalizado');

  readonly tipos: { value: InformeTipo; label: string }[] = (
    Object.entries(INFORME_TIPO_LABELS) as [InformeTipo, string][]
  ).map(([value, label]) => ({ value, label }));

  form: FormGroup = this.fb.group({
    tipo: [this.data.informe?.tipo ?? 'evaluacion', [Validators.required]],
    titulo: [
      this.data.informe?.titulo ?? '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    ],
    motivo: [
      this.data.informe?.motivo ?? '',
      [Validators.required, Validators.minLength(10)],
    ],
    antecedentes: [this.data.informe?.antecedentes ?? ''],
    observaciones: [
      this.data.informe?.observaciones ?? '',
      [Validators.required, Validators.minLength(10)],
    ],
    recomendaciones: [this.data.informe?.recomendaciones ?? ''],
    derivadoA: [this.data.informe?.derivadoA ?? ''],
    confidencial: [this.data.informe?.confidencial ?? true],
  });

  cancel() { this.ref.close(false); }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isLocked()) {
      this.errorMsg.set('Este informe está finalizado y no puede modificarse.');
      return;
    }
    const v = this.form.value;
    const payload = {
      tipo: v.tipo as InformeTipo,
      titulo: v.titulo as string,
      motivo: v.motivo as string,
      antecedentes: (v.antecedentes as string)?.trim() || null,
      observaciones: v.observaciones as string,
      recomendaciones: (v.recomendaciones as string)?.trim() || null,
      derivadoA: (v.derivadoA as string)?.trim() || null,
      confidencial: !!v.confidencial,
    };
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      if (this.data.informe) {
        await this.store.updateInforme(
          this.data.informe.id, this.data.studentId, payload,
        );
        this.toastr.success('Informe actualizado');
      } else {
        await this.store.createInforme({
          studentId: this.data.studentId,
          ...payload,
        });
        this.toastr.success('Informe creado');
      }
      this.ref.close(true);
    } catch (err: unknown) {
      const e = err as { error?: { message?: string | string[] } };
      const raw = e?.error?.message;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      this.errorMsg.set(typeof msg === 'string' ? msg : 'No se pudo guardar el informe');
    } finally {
      this.loading.set(false);
    }
  }
}
