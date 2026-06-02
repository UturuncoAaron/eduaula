import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import { InformePsicologico } from '../../../../core/models/psychology';

export interface InformeFormDialogData {
  studentId: string;
  studentName: string;
  informe?: InformePsicologico;
  citaId?: string;
}

interface Seccion {
  label: string;
  icon: string;
}

@Component({
  selector: 'app-informe-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSlideToggleModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatProgressSpinnerModule, MatTooltipModule,
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

  readonly secciones: Seccion[] = [
    { label: 'Filiación', icon: 'person' },
    { label: 'Consulta', icon: 'help_outline' },
    { label: 'Antecedentes', icon: 'history' },
    { label: 'Observaciones', icon: 'visibility' },
    { label: 'Resultados', icon: 'analytics' },
    { label: 'Conclusiones', icon: 'task_alt' },
    { label: 'Recomendaciones', icon: 'recommend' },
  ];

  readonly activeStep = signal(0);

  readonly form: FormGroup = this.fb.group({
    // I. Filiación
    edadEvaluacion: [this.data.informe?.edadEvaluacion ?? null],
    motivoConsultaCorto: [this.data.informe?.motivoConsultaCorto ?? ''],
    referente: [this.data.informe?.referente ?? ''],
    fechaEvaluacionInicio: [this.data.informe?.fechaEvaluacionInicio ?? ''],
    fechaEvaluacionFin: [this.data.informe?.fechaEvaluacionFin ?? ''],
    fechaInforme: [this.data.informe?.fechaInforme ?? ''],
    tecnicasUtilizadas: [this.data.informe?.tecnicasUtilizadas ?? ''],
    instrumentosUtilizados: [this.data.informe?.instrumentosUtilizados ?? ''],
    // II. Motivo
    motivoConsulta: [this.data.informe?.motivoConsulta ?? ''],
    // III. Antecedentes
    antecedentesFamilia: [this.data.informe?.antecedentesFamilia ?? ''],
    antecedentesAcademico: [this.data.informe?.antecedentesAcademico ?? ''],
    antecedentesEscolar: [this.data.informe?.antecedentesEscolar ?? ''],
    antecedentesAutopercepcion: [this.data.informe?.antecedentesAutopercepcion ?? ''],
    // IV. Observaciones
    observacionesConducta: [this.data.informe?.observacionesConducta ?? ''],
    // V. Resultados
    resultadosCognitiva: [this.data.informe?.resultadosCognitiva ?? ''],
    resultadosEmocional: [this.data.informe?.resultadosEmocional ?? ''],
    resultadosConductual: [this.data.informe?.resultadosConductual ?? ''],
    resultadosSocial: [this.data.informe?.resultadosSocial ?? ''],
    // VI–VII. Análisis + Conclusiones
    analisisResultados: [this.data.informe?.analisisResultados ?? ''],
    conclusiones: [this.data.informe?.conclusiones ?? ''],
    // VIII. Recomendaciones
    recomendacionesInstitucion: [this.data.informe?.recomendacionesInstitucion ?? ''],
    recomendacionesFamilia: [this.data.informe?.recomendacionesFamilia ?? ''],
    // Control
    confidencial: [this.data.informe?.confidencial ?? true],
  });

  len(ctrl: string): number {
    return (this.form.get(ctrl)?.value as string | null)?.length ?? 0;
  }

  goTo(step: number): void { this.activeStep.set(step); }

  cancel(): void { this.ref.close(false); }

  async submit(): Promise<void> {
    if (this.isLocked()) return;

    const v = this.form.getRawValue();
    const str = (val: unknown): string | null =>
      (typeof val === 'string' && val.trim()) ? val.trim() : null;

    const payload = {
      edadEvaluacion: v.edadEvaluacion ? Number(v.edadEvaluacion) : null,
      motivoConsultaCorto: str(v.motivoConsultaCorto),
      referente: str(v.referente),
      fechaEvaluacionInicio: str(v.fechaEvaluacionInicio),
      fechaEvaluacionFin: str(v.fechaEvaluacionFin),
      fechaInforme: str(v.fechaInforme),
      tecnicasUtilizadas: str(v.tecnicasUtilizadas),
      instrumentosUtilizados: str(v.instrumentosUtilizados),
      motivoConsulta: str(v.motivoConsulta),
      antecedentesFamilia: str(v.antecedentesFamilia),
      antecedentesAcademico: str(v.antecedentesAcademico),
      antecedentesEscolar: str(v.antecedentesEscolar),
      antecedentesAutopercepcion: str(v.antecedentesAutopercepcion),
      observacionesConducta: str(v.observacionesConducta),
      resultadosCognitiva: str(v.resultadosCognitiva),
      resultadosEmocional: str(v.resultadosEmocional),
      resultadosConductual: str(v.resultadosConductual),
      resultadosSocial: str(v.resultadosSocial),
      analisisResultados: str(v.analisisResultados),
      conclusiones: str(v.conclusiones),
      recomendacionesInstitucion: str(v.recomendacionesInstitucion),
      recomendacionesFamilia: str(v.recomendacionesFamilia),
      confidencial: !!v.confidencial,
      ...(this.data.citaId && !this.data.informe ? { citaId: this.data.citaId } : {}),
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
      this.errorMsg.set(
        typeof raw === 'string' ? raw
          : Array.isArray(raw) ? raw[0]
            : 'No se pudo guardar el informe',
      );
    } finally {
      this.loading.set(false);
    }
  }
}