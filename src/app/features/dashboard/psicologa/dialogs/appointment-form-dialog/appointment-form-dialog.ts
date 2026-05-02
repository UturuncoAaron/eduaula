import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../../../psychology/stores/psychology.store';
import {
  AppointmentModalidad, AppointmentTipo,
  AssignedStudent, ParentOfStudent,
} from '../../../../../core/models/psychology';

export interface AppointmentFormDialogData {
  preselectedStudentId?: string;
}

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './appointment-form-dialog.html',
  styleUrl: './appointment-form-dialog.scss',
})
export class AppointmentFormDialog implements OnInit {
  readonly data: AppointmentFormDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AppointmentFormDialog>);
  private fb = inject(FormBuilder);
  readonly store = inject(PsychologyStore);
  private toastr = inject(ToastService);

  loading = signal(false);
  loadingParents = signal(false);
  errorMsg = signal('');
  parents = signal<ParentOfStudent[]>([]);

  readonly tipos: { value: AppointmentTipo; label: string }[] = [
    { value: 'academico',   label: 'Académico' },
    { value: 'conductual',  label: 'Conductual' },
    { value: 'psicologico', label: 'Psicológico' },
    { value: 'familiar',    label: 'Familiar' },
    { value: 'otro',        label: 'Otro' },
  ];

  readonly modalidades: { value: AppointmentModalidad; label: string }[] = [
    { value: 'presencial', label: 'Presencial' },
    { value: 'virtual',    label: 'Virtual' },
    { value: 'telefonico', label: 'Telefónica' },
  ];

  form: FormGroup = this.fb.group({
    studentId:   [this.data.preselectedStudentId ?? '', [Validators.required]],
    parentId:    ['', [Validators.required]],
    tipo:        ['psicologico', [Validators.required]],
    modalidad:   ['presencial', [Validators.required]],
    motivo:      ['', [Validators.required, Validators.minLength(5)]],
    scheduledAt: ['', [Validators.required]],
    durationMin: [30, [Validators.required, Validators.min(15), Validators.max(120)]],
    priorNotes:  [''],
  });

  ngOnInit(): void {
    if (this.store.myStudents().length === 0) {
      this.store.loadMyStudents();
    }
    if (this.data.preselectedStudentId) {
      this.loadParents(this.data.preselectedStudentId);
    }
  }

  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentName(p: ParentOfStudent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  onStudentChange(id: string) {
    this.form.patchValue({ parentId: '' });
    this.parents.set([]);
    if (id) this.loadParents(id);
  }

  private async loadParents(studentId: string) {
    this.loadingParents.set(true);
    try {
      const parents = await this.store.getStudentParents(studentId);
      this.parents.set(parents);
      if (parents.length === 1) {
        this.form.patchValue({ parentId: parents[0].id });
      }
    } catch {
      this.parents.set([]);
    } finally {
      this.loadingParents.set(false);
    }
  }

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
      await this.store.createAppointment({
        studentId: v.studentId,
        parentId:  v.parentId,
        tipo:      v.tipo,
        modalidad: v.modalidad,
        motivo:    v.motivo,
        scheduledAt: new Date(v.scheduledAt).toISOString(),
        durationMin: v.durationMin,
        priorNotes:  v.priorNotes || undefined,
      });
      this.toastr.success('Cita creada');
      this.ref.close(true);
    } catch (err: any) {
      const msg = err?.error?.message ?? 'No se pudo crear la cita';
      this.errorMsg.set(typeof msg === 'string' ? msg : 'Error inesperado');
    } finally {
      this.loading.set(false);
    }
  }
}
