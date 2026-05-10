import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ToastService } from 'ngx-toastr-notifier';

import { AppointmentsStore } from '../../data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import { AppointmentTipo } from '../../../../core/models/appointments';
import { combineDateAndTime, startOfDay } from '../../../../shared/utils/calendar-week';
import { parseApiError } from '../../../../shared/utils/api-errors';

const MIN_LEAD_MINUTES = 15;

interface StudentOption {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  grado: string;
  seccion: string;
  padre?: { id: string; nombre: string; apellido_paterno: string } | null;
}

@Component({
  selector: 'app-teacher-request-appointment-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatAutocompleteModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatDatepickerModule,
  ],
  templateUrl: './teacher-request-appointment-dialog.html',
  styleUrl: './teacher-request-appointment-dialog.scss',
})
export class TeacherRequestAppointmentDialog implements OnInit {
  private ref = inject(MatDialogRef<TeacherRequestAppointmentDialog>);
  private fb = inject(FormBuilder);
  private store = inject(AppointmentsStore);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);

  readonly tipos: { value: AppointmentTipo; label: string }[] = [
    { value: 'academico', label: 'Académico' },
    { value: 'conductual', label: 'Conductual' },
    { value: 'familiar', label: 'Familiar' },
    { value: 'disciplinario', label: 'Disciplinario' },
    { value: 'otro', label: 'Otro' },
  ];

  readonly minDate = startOfDay(new Date());

  loading = signal(false);
  errorMsg = signal('');
  searching = signal(false);
  students = signal<StudentOption[]>([]);
  selected = signal<StudentOption | null>(null);

  readonly parentLabel = computed<string>(() => {
    const s = this.selected();
    if (!s?.padre) return '';
    return `${s.padre.nombre} ${s.padre.apellido_paterno}`.trim();
  });

  form: FormGroup = this.fb.group({
    studentQuery: ['', [Validators.required]],
    tipo: ['academico', [Validators.required]],
    date: [null as Date | null, [Validators.required]],
    time: ['', [Validators.required]],
    durationMin: [30, [Validators.required, Validators.min(15), Validators.max(180)]],
    motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    priorNotes: [''],
  });

  ngOnInit(): void {
    this.form.get('studentQuery')!.valueChanges.subscribe(async (raw: string | StudentOption | null) => {
      if (typeof raw !== 'string') return;
      if (!raw || raw.trim().length < 2) { this.students.set([]); return; }
      this.searching.set(true);
      try {
        const items = await this.store.searchMyStudents(raw);
        this.students.set(items);
      } finally {
        this.searching.set(false);
      }
    });
  }

  displayStudent = (s: StudentOption | string): string => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim()
      + ` · ${s.grado} ${s.seccion}`;
  };

  onSelectStudent(s: StudentOption): void {
    this.selected.set(s);
    this.form.patchValue({ studentQuery: s }, { emitEvent: false });
  }

  cancel(): void { this.ref.close(false); }

  async submit(): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) { this.errorMsg.set('Sesión inválida.'); return; }

    const sel = this.selected();
    if (!sel) {
      this.errorMsg.set('Selecciona un alumno de la lista.');
      return;
    }
    if (!sel.padre) {
      this.errorMsg.set('Este alumno no tiene un padre/tutor vinculado en el sistema.');
      return;
    }

    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;

    const scheduled = combineDateAndTime(v.date as Date, v.time as string);
    const minStart = Date.now() + MIN_LEAD_MINUTES * 60_000;
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < minStart) {
      this.errorMsg.set(`La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`);
      return;
    }

    if (sel.padre.id === me.id) {
      this.errorMsg.set('No puedes convocarte a ti mismo.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      await this.store.createAppointment({
        convocadoAId: sel.padre.id,
        studentId: sel.id,
        parentId: sel.padre.id,
        tipo: v.tipo,
        motivo: v.motivo,
        scheduledAt: scheduled.toISOString(),
        durationMin: v.durationMin,
        priorNotes: v.priorNotes || undefined,
      });
      this.toastr.success('Cita enviada al padre/tutor — pendiente de su confirmación');
      this.ref.close(true);
    } catch (err: unknown) {
      this.errorMsg.set(parseApiError(err, 'No se pudo crear la cita'));
    } finally {
      this.loading.set(false);
    }
  }
}