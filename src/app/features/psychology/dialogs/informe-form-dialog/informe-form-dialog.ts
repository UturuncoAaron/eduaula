import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import {
  FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
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

const TITULO_MAX = 200;
const MOTIVO_MAX = 1_000;
const OBSERV_MAX = 4_000;
const TEXTO_MAX = 2_000;

@Component({
  selector: 'app-informe-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule,
    MatButtonModule, MatIconModule, MatDividerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './informe-form-dialog.html',
  styleUrl: './informe-form-dialog.scss',
})
export class InformeFormDialog {
  readonly data: InformeFormDialogData = inject(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<InformeFormDialog>);
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(PsychologyStore);
  private readonly toastr = inject(ToastService);

  readonly loading = signal(false);
  readonly errorMsg = signal('');

  readonly isEdit = computed(() => !!this.data.informe);
  readonly isLocked = computed(() => this.data.informe?.estado === 'finalizado');

  readonly tipos: { value: InformeTipo; label: string; icon: string }[] = [
    { value: 'evaluacion', label: INFORME_TIPO_LABELS.evaluacion, icon: 'psychology' },
    { value: 'seguimiento', label: INFORME_TIPO_LABELS.seguimiento, icon: 'timeline' },
    { value: 'derivacion_familia', label: INFORME_TIPO_LABELS.derivacion_familia, icon: 'family_restroom' },
    { value: 'derivacion_externa', label: INFORME_TIPO_LABELS.derivacion_externa, icon: 'medical_services' },
  ];

  /** Límites de caracteres expuestos al template. */
  readonly limits = {
    titulo: TITULO_MAX, motivo: MOTIVO_MAX,
    observaciones: OBSERV_MAX, texto: TEXTO_MAX,
  };

  readonly form: FormGroup = this.fb.group({
    tipo: [this.data.informe?.tipo ?? 'evaluacion', [Validators.required]],
    confidencial: [this.data.informe?.confidencial ?? true],
    titulo: [
      this.data.informe?.titulo ?? '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(TITULO_MAX)],
    ],
    motivo: [
      this.data.informe?.motivo ?? '',
      [Validators.required, Validators.minLength(10), Validators.maxLength(MOTIVO_MAX)],
    ],
    antecedentes: [this.data.informe?.antecedentes ?? '', [Validators.maxLength(TEXTO_MAX)]],
    observaciones: [
      this.data.informe?.observaciones ?? '',
      [Validators.required, Validators.minLength(10), Validators.maxLength(OBSERV_MAX)],
    ],
    recomendaciones: [this.data.informe?.recomendaciones ?? '', [Validators.maxLength(TEXTO_MAX)]],
    derivadoA: [this.data.informe?.derivadoA ?? '', [Validators.maxLength(TITULO_MAX)]],
  });

  // Helpers para mostrar contadores en el template (sin pipes extras).
  len(ctrl: 'titulo' | 'motivo' | 'observaciones' | 'antecedentes' | 'recomendaciones' | 'derivadoA'): number {
    return (this.form.get(ctrl)?.value as string | null)?.length ?? 0;
  }

  hasError(ctrl: string, err: string): boolean {
    const c = this.form.get(ctrl);
    return !!c && c.hasError(err) && (c.touched || c.dirty);
  }

  cancel(): void { this.ref.close(false); }

  async submit(): Promise<void> {
    if (this.isLocked()) {
      this.errorMsg.set('Este informe está finalizado y no puede modificarse.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      tipo: v.tipo as InformeTipo,
      titulo: (v.titulo as string).trim(),
      motivo: (v.motivo as string).trim(),
      antecedentes: (v.antecedentes as string)?.trim() || null,
      observaciones: (v.observaciones as string).trim(),
      recomendaciones: (v.recomendaciones as string)?.trim() || null,
      derivadoA: (v.derivadoA as string)?.trim() || null,
      confidencial: !!v.confidencial,
    };

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      if (this.data.informe) {
        await this.store.updateInforme(this.data.informe.id, this.data.studentId, payload);
        this.toastr.success('Informe actualizado');
      } else {
        await this.store.createInforme({ studentId: this.data.studentId, ...payload });
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