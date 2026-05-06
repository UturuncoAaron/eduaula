import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import { PsychologistAvailability } from '../../../../../app/core/models/psychology';

export interface BlockFormDialogData {
  availability: PsychologistAvailability[];
}

@Component({
  selector: 'app-block-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './block-form-dialog.html',
  styleUrl: './block-form-dialog.scss',
})
export class BlockFormDialog {
  readonly data: BlockFormDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<BlockFormDialog>);
  private fb = inject(FormBuilder);
  private store = inject(PsychologyStore);
  private toastr = inject(ToastService);

  loading = signal(false);
  errorMsg = signal('');

  startSig = signal<string>('');
  endSig = signal<string>('');

  form: FormGroup = this.fb.group({
    startDate: ['', [Validators.required]],
    endDate:   ['', [Validators.required]],
    motivo:    [''],
  });

  /** Días de la semana cubiertos por el bloqueo. */
  readonly overlappingDays = computed<string[]>(() => {
    const start = this.startSig();
    const end = this.endSig();
    if (!start || !end) return [];

    const sd = new Date(start);
    const ed = new Date(end);
    if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || sd > ed) return [];

    // Map JS getDay() (0..6) → backend weekDay strings (lunes..viernes)
    const weekMap: Record<number, string> = {
      1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes',
    };

    const found = new Set<string>();
    const cursor = new Date(sd);
    while (cursor <= ed) {
      const wd = weekMap[cursor.getDay()];
      if (wd && this.data.availability.some(a => a.weekDay === wd && a.activo)) {
        found.add(wd);
      }
      cursor.setDate(cursor.getDate() + 1);
      // safety: max 60 days
      if (found.size > 0 && (cursor.getTime() - sd.getTime()) > 60 * 86400000) break;
    }

    return Array.from(found);
  });

  readonly hasOverlap = computed(() => this.overlappingDays().length > 0);

  onStartChange(v: string) { this.startSig.set(v); }
  onEndChange(v: string)   { this.endSig.set(v); }

  cancel() { this.ref.close(false); }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const v = this.form.value;
      await this.store.createBlock({
        startDate: new Date(v.startDate).toISOString(),
        endDate:   new Date(v.endDate).toISOString(),
        motivo:    v.motivo || undefined,
      });
      this.toastr.success('Bloqueo creado');
      this.ref.close(true);
    } catch (err: any) {
      const msg = err?.error?.message ?? 'No se pudo crear el bloqueo';
      this.errorMsg.set(typeof msg === 'string' ? msg : 'Error inesperado');
    } finally {
      this.loading.set(false);
    }
  }
}
