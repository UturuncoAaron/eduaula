import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import {
  PsychologyRecord, RecordCategoria,
} from '../../../../../app/core/models/psychology';

export interface RecordFormDialogData {
  studentId: string;
  studentName: string;
  record?: PsychologyRecord; // si viene, es modo edición
}

@Component({
  selector: 'app-record-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './record-form-dialog.html',
  styleUrl: './record-form-dialog.scss',
})
export class RecordFormDialog {
  readonly data: RecordFormDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<RecordFormDialog>);
  private fb = inject(FormBuilder);
  private store = inject(PsychologyStore);
  private toastr = inject(ToastService);

  loading = signal(false);
  errorMsg = signal('');

  readonly isEdit = !!this.data.record;

  readonly categorias: { value: RecordCategoria; label: string }[] = [
    { value: 'conductual', label: 'Conductual' },
    { value: 'academico',  label: 'Académico' },
    { value: 'familiar',   label: 'Familiar' },
    { value: 'emocional',  label: 'Emocional' },
    { value: 'otro',       label: 'Otro' },
  ];

  form: FormGroup = this.fb.group({
    categoria: [this.data.record?.categoria ?? 'emocional', [Validators.required]],
    contenido: [this.data.record?.contenido ?? '', [Validators.required, Validators.minLength(5)]],
  });

  cancel() { this.ref.close(false); }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { categoria, contenido } = this.form.value;
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      if (this.isEdit && this.data.record) {
        await this.store.updateRecord(this.data.record.id, this.data.studentId, {
          categoria, contenido,
        });
        this.toastr.success('Ficha actualizada');
      } else {
        await this.store.createRecord({
          studentId: this.data.studentId,
          categoria, contenido,
        });
        this.toastr.success('Ficha creada');
      }
      this.ref.close(true);
    } catch (err: any) {
      const msg = err?.error?.message ?? 'No se pudo guardar la ficha';
      this.errorMsg.set(typeof msg === 'string' ? msg : 'Error inesperado');
    } finally {
      this.loading.set(false);
    }
  }
}
