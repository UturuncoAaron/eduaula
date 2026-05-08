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
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ToastService } from 'ngx-toastr-notifier';

import { PsychologyStore } from '../../data-access/psychology.store';
import { AuthService } from '../../../../core/auth/auth';
import {
  AppointmentModalidad, AppointmentTipo,
  AssignedStudent, AvailableSlot, ParentOfStudent, SearchableParent,
} from '../../../../core/models/psychology';

export interface AppointmentFormDialogData {
  preselectedStudentId?: string;
}

/**
 * Mínimos minutos de anticipación que exige el backend al crear una cita.
 * Lo replicamos aquí para validar antes de enviar y dar feedback inmediato.
 */
const MIN_LEAD_MINUTES = 15;
const DEFAULT_LOOKAHEAD_DAYS = 14;

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatAutocompleteModule, MatTooltipModule,
    MatDatepickerModule, MatChipsModule, MatCheckboxModule,
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

  loading        = signal(false);
  loadingParents = signal(false);
  loadingSlots   = signal(false);
  searching      = signal(false);
  searchingParent = signal(false);
  errorMsg       = signal('');

  parents             = signal<ParentOfStudent[]>([]);
  searchResults       = signal<AssignedStudent[]>([]);
  parentSearchResults = signal<SearchableParent[]>([]);
  selectedStudent     = signal<AssignedStudent | null>(null);
  selectedParent      = signal<SearchableParent | null>(null);
  studentSearchQuery  = signal('');
  parentSearchQuery   = signal('');

  includeStudent = signal(true);
  includeParent  = signal(false);

  slots = signal<AvailableSlot[]>([]);

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

  readonly minDate = startOfDay(new Date());

  modalidadValue = signal('presencial');
  readonly isVirtual = computed(() => this.modalidadValue() === 'virtual');

  readonly slotsGroupedByDay = computed<{ label: string; slots: AvailableSlot[] }[]>(() => {
    const all = this.slots();
    if (all.length === 0) return [];
    const groups = new Map<string, AvailableSlot[]>();
    for (const iso of all) {
      const d = new Date(iso);
      const key = d.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(iso);
    }
    return Array.from(groups.entries()).map(([label, slots]) => ({ label, slots }));
  });

  form: FormGroup = this.fb.group({
    studentId:   [this.data.preselectedStudentId ?? ''],
    parentId:    [''],
    tipo:        ['psicologico', [Validators.required]],
    modalidad:   ['presencial', [Validators.required]],
    motivo:      ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    date:        [null as Date | null, [Validators.required]],
    time:        ['', [Validators.required]],
    durationMin: [30, [Validators.required, Validators.min(15), Validators.max(180)]],
    priorNotes:  [''],
    meetingLink: [''],
  });

  ngOnInit(): void {
    if (this.store.myStudents().length === 0) {
      this.store.loadMyStudents();
    }
    if (this.data.preselectedStudentId) {
      this.loadParents(this.data.preselectedStudentId);
      this.includeParent.set(true);
      const found = this.store.myStudents().find(s => s.id === this.data.preselectedStudentId);
      if (found) this.selectedStudent.set(found);
    }

    this.form.get('modalidad')?.valueChanges.subscribe((m: string) => {
      this.modalidadValue.set(m);
      if (m !== 'virtual') {
        this.form.patchValue({ meetingLink: '' });
      }
    });

    this.refreshSlots();
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
    this.form.patchValue({ studentId: student.id });
  }

  clearStudent() {
    this.selectedStudent.set(null);
    this.searchResults.set([]);
    this.studentSearchQuery.set('');
    this.form.patchValue({ studentId: '' });
  }

  async onSearchParents(value: string) {
    this.parentSearchQuery.set(value);
    const term = value.trim();
    if (term.length < 2) {
      this.parentSearchResults.set([]);
      return;
    }
    this.searchingParent.set(true);
    try {
      const found = await this.store.searchAllParents(term);
      this.parentSearchResults.set(found);
    } catch {
      this.parentSearchResults.set([]);
    } finally {
      this.searchingParent.set(false);
    }
  }

  onParentSelected(parent: SearchableParent) {
    this.selectedParent.set(parent);
    this.form.patchValue({ parentId: parent.id });
  }

  clearParent() {
    this.selectedParent.set(null);
    this.parentSearchResults.set([]);
    this.parentSearchQuery.set('');
    this.form.patchValue({ parentId: '' });
  }

  parentFullName(p: SearchableParent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  toggleIncludeStudent(checked: boolean) {
    this.includeStudent.set(checked);
    if (!checked) {
      this.clearStudent();
      if (!this.includeParent()) this.includeParent.set(true);
    }
  }

  toggleIncludeParent(checked: boolean) {
    this.includeParent.set(checked);
    if (!checked) {
      this.clearParent();
      if (!this.includeStudent()) this.includeStudent.set(true);
    }
  }

  formatSlotTime(iso: string): string {
    const d = new Date(iso);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  pickSlot(iso: string) {
    const d = new Date(iso);
    const date = startOfDay(d);
    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    this.form.patchValue({ date, time });
  }

  async onDurationChange() {
    this.form.patchValue({ date: null, time: '' });
    await this.refreshSlots();
  }

  private async refreshSlots(): Promise<void> {
    const psicologaId = this.auth.currentUser()?.id;
    if (!psicologaId) return;
    this.loadingSlots.set(true);
    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + DEFAULT_LOOKAHEAD_DAYS);
      const items = await this.store.getAvailableSlots(
        psicologaId,
        from.toISOString(),
        to.toISOString(),
        this.form.value.durationMin || 30,
      );
      this.slots.set(items);
    } catch {
      this.slots.set([]);
    } finally {
      this.loadingSlots.set(false);
    }
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
    const hasStudent = this.includeStudent() && !!this.form.value.studentId;
    const hasParent  = this.includeParent()  && !!this.form.value.parentId;

    if (!hasStudent && !hasParent) {
      this.errorMsg.set('Debe seleccionar al menos un alumno o un padre/tutor.');
      return;
    }

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

    const scheduled = combineDateAndTime(v.date as Date, v.time as string);
    const minStart  = Date.now() + MIN_LEAD_MINUTES * 60_000;
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < minStart) {
      this.errorMsg.set(`La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`);
      return;
    }

    const convocadoAId = hasParent ? v.parentId : v.studentId;
    if (convocadoAId === psicologaId) {
      this.errorMsg.set('No puedes convocarte a ti misma.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      await this.store.createAppointment({
        convocadoAId,
        studentId:    hasStudent ? v.studentId : undefined,
        parentId:     hasParent  ? v.parentId  : undefined,
        tipo:         v.tipo,
        modalidad:    v.modalidad,
        motivo:       v.motivo,
        scheduledAt:  scheduled.toISOString(),
        durationMin:  v.durationMin,
        priorNotes:   v.priorNotes || undefined,
        meetingLink:  v.modalidad === 'virtual' && v.meetingLink ? v.meetingLink : undefined,
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

function combineDateAndTime(date: Date, time: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return d;
}

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
