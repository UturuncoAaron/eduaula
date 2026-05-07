import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import { AuthService } from '../../../../core/auth/auth';
import {
  AppointmentModalidad, AppointmentTipo,
  AssignedStudent, ParentOfStudent,
} from '../../../../core/models/psychology';

export interface AppointmentFormDialogData {
  preselectedStudentId?: string;
}

/**
 * Mínimos minutos de anticipación que exige el backend al crear una cita.
 * Lo replicamos aquí para validar antes de enviar y dar feedback inmediato.
 */
const MIN_LEAD_MINUTES = 15;
/** Granularidad del select de hora (en minutos). */
const TIME_STEP_MINUTES = 30;
/** Rango horario "trabajable" para el select de hora. */
const WORK_HOUR_START = 7;
const WORK_HOUR_END   = 21;

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatAutocompleteModule, MatTooltipModule,
    MatDatepickerModule,
  ],
  templateUrl: './appointment-form-dialog.html',
  styleUrl: './appointment-form-dialog.scss',
})
export class AppointmentFormDialog implements OnInit {
  readonly data: AppointmentFormDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AppointmentFormDialog>);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  readonly store = inject(PsychologyStore);
  private toastr = inject(ToastService);

  // ── Estado UI ──────────────────────────────────────────────────
  loading        = signal(false);
  loadingParents = signal(false);
  searching      = signal(false);
  errorMsg       = signal('');

  parents             = signal<ParentOfStudent[]>([]);
  searchResults       = signal<AssignedStudent[]>([]);
  selectedStudent     = signal<AssignedStudent | null>(null);
  studentSearchQuery  = signal('');

  /** Combina resultados de búsqueda + alumnos asignados (sin duplicados). */
  readonly availableStudents = computed<AssignedStudent[]>(() => {
    const search = this.searchResults();
    const mine   = this.store.myStudents();
    const term   = this.studentSearchQuery().trim().toLowerCase();
    const seen = new Set<string>();
    const merged: AssignedStudent[] = [];
    for (const s of [...search, ...mine]) {
      if (seen.has(s.id)) continue;
      const matchesTerm = !term ||
        [s.nombre, s.apellido_paterno, s.apellido_materno ?? '', s.codigo_estudiante]
          .join(' ').toLowerCase().includes(term);
      if (!matchesTerm) continue;
      seen.add(s.id);
      merged.push(s);
    }
    return merged.slice(0, 25);
  });

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

  /**
   * El backend exige que `convocadoAId` sea distinto del caller y que sea un
   * rol válido (psicologa, docente, padre, admin, auxiliar — el alumno NO
   * puede ser convocado). Para la psicóloga, la cita es una reunión con el
   * padre/tutor del alumno: por eso el padre es **requerido** y se usa como
   * `convocadoAId`.
   */
  /** Bandera reactiva para recomputar `availableTimes` al cambiar la fecha. */
  selectedDate = signal<Date | null>(null);

  /** Lista completa de horas (HH:mm) para el select. */
  private readonly allTimes: string[] = buildTimeOptions(
    WORK_HOUR_START, WORK_HOUR_END, TIME_STEP_MINUTES,
  );

  /** Horas disponibles según la fecha (filtra pasadas si es hoy). */
  readonly availableTimes = computed<string[]>(() => {
    const d = this.selectedDate();
    if (!d) return this.allTimes;
    if (!isSameDay(d, new Date())) return this.allTimes;
    const minMs = Date.now() + MIN_LEAD_MINUTES * 60_000;
    return this.allTimes.filter(t => combineDateAndTime(d, t).getTime() >= minMs);
  });

  /** Para `[min]` del datepicker: hoy. */
  readonly minDate = startOfDay(new Date());

  form: FormGroup = this.fb.group({
    studentId:   [this.data.preselectedStudentId ?? '', [Validators.required]],
    parentId:    ['', [Validators.required]],
    tipo:        ['psicologico', [Validators.required]],
    modalidad:   ['presencial', [Validators.required]],
    motivo:      ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    date:        [null as Date | null, [Validators.required]],
    time:        ['', [Validators.required]],
    durationMin: [30, [Validators.required, Validators.min(15), Validators.max(180)]],
    priorNotes:  [''],
  });

  ngOnInit(): void {
    if (this.store.myStudents().length === 0) {
      this.store.loadMyStudents();
    }
    if (this.data.preselectedStudentId) {
      this.loadParents(this.data.preselectedStudentId);
      const found = this.store.myStudents().find(s => s.id === this.data.preselectedStudentId);
      if (found) this.selectedStudent.set(found);
    }
    // Mantenemos el signal sincronizado con el form para `availableTimes`.
    this.form.get('date')?.valueChanges.subscribe((d: Date | null) => {
      this.selectedDate.set(d);
      const t = this.form.value.time as string;
      if (t && !this.availableTimes().includes(t)) {
        this.form.patchValue({ time: '' });
      }
    });
  }

  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentName(p: ParentOfStudent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  /** Búsqueda en directorio (mínimo 2 chars). */
  async onSearchStudents(value: string) {
    this.studentSearchQuery.set(value);
    const term = value.trim();
    if (term.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    try {
      const found = await this.store.searchAllStudents(term);
      this.searchResults.set(found);
    } catch {
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  onStudentSelected(student: AssignedStudent) {
    this.selectedStudent.set(student);
    this.form.patchValue({ studentId: student.id, parentId: '' });
    this.parents.set([]);
    this.loadParents(student.id);
  }

  clearStudent() {
    this.selectedStudent.set(null);
    this.searchResults.set([]);
    this.studentSearchQuery.set('');
    this.parents.set([]);
    this.form.patchValue({ studentId: '', parentId: '' });
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
    const psicologaId = this.auth.currentUser()?.id;
    if (!psicologaId) {
      this.errorMsg.set('Sesión inválida, vuelve a iniciar sesión.');
      return;
    }
    const v = this.form.value;

    // Validación local de fecha/hora — replica la regla del backend.
    const scheduled = combineDateAndTime(v.date as Date, v.time as string);
    const minStart  = Date.now() + MIN_LEAD_MINUTES * 60_000;
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < minStart) {
      this.errorMsg.set(`La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`);
      return;
    }

    if (v.parentId === psicologaId) {
      this.errorMsg.set('No puedes convocarte a ti misma. Selecciona un padre/tutor distinto.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      await this.store.createAppointment({
        // El padre/tutor es la persona convocada (≠ caller).
        convocadoAId: v.parentId,
        studentId:    v.studentId,
        parentId:     v.parentId,
        tipo:         v.tipo,
        modalidad:    v.modalidad,
        motivo:       v.motivo,
        scheduledAt:  scheduled.toISOString(),
        durationMin:  v.durationMin,
        priorNotes:   v.priorNotes || undefined,
      });
      this.toastr.success('Cita creada');
      this.ref.close(true);
    } catch (err: unknown) {
      this.errorMsg.set(parseApiError(err, 'No se pudo crear la cita'));
    } finally {
      this.loading.set(false);
    }
  }

}

// ── Helpers ────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

/** Genera ['07:00','07:30',...,'21:00'] según los límites/step configurados. */
function buildTimeOptions(hStart: number, hEnd: number, stepMin: number): string[] {
  const out: string[] = [];
  for (let h = hStart; h <= hEnd; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      if (h === hEnd && m > 0) break;
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
}

/** Combina fecha (sólo Y/M/D) + hora 'HH:mm' en una Date local. */
function combineDateAndTime(date: Date, time: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return d;
}

/**
 * Helper compartido — entiende el formato del `HttpExceptionFilter`:
 * `{ message: string }` o `{ message: { message: string | string[] } }`.
 */
export function parseApiError(err: unknown, fallback: string): string {
  const e = err as { error?: { message?: unknown } };
  const raw = e?.error?.message;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const inner = (raw as { message?: unknown }).message;
    if (typeof inner === 'string') return inner;
    if (Array.isArray(inner) && inner.length > 0 && typeof inner[0] === 'string') {
      return inner.join(', ');
    }
  }
  return fallback;
}
