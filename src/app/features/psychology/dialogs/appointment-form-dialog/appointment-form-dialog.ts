import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import {
  BookingCalendar, BookingPickEvent, BookingSelectedSlot,
} from '../../../../shared/components/booking-calendar/booking-calendar';
import { combineDateAndTime, diaLabel, getCurrentMonday, pad2, startOfDay } from '../../../../shared/utils/calendar-week';
import { parseApiError } from '../../../../shared/utils/api-errors';
import { PsychologyStore } from '../../data-access/psychology.store';
import { AppointmentsStore } from '../../../appointments/data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import {
  AccountAvailability, AppointmentTipo, DiaSemana, SlotTaken,
  APPOINTMENT_RULES, ruleForRol, ruleToStartHour, ruleToEndHour,
  ruleToMaxConsecutiveSlots,
} from '../../../../core/models/appointments';
import { AssignedStudent, ParentOfStudent, SearchableParent } from '../../../../core/models/psychology';

export interface AppointmentFormDialogData {
  preselectedStudentId?: string;
}

const MIN_LEAD_MINUTES = 15;

function addMinutesToHour(hour: string, minutes: number): string {
  const [h, m] = hour.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

interface PickedSlot {
  dia: DiaSemana;
  hour: string;
  dateLabel: string;
  date: Date;
}

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatAutocompleteModule, MatTooltipModule,
    BookingCalendar,
  ],
  templateUrl: './appointment-form-dialog.html',
  styleUrl: './appointment-form-dialog.scss',
})
export class AppointmentFormDialog implements OnInit {
  readonly data: AppointmentFormDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AppointmentFormDialog>);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);
  readonly store = inject(PsychologyStore);
  readonly appointmentsStore = inject(AppointmentsStore);

  readonly tipos: { value: AppointmentTipo; label: string }[] = [
    { value: 'academico', label: 'Académico' },
    { value: 'conductual', label: 'Conductual' },
    { value: 'psicologico', label: 'Psicológico' },
    { value: 'familiar', label: 'Familiar' },
    { value: 'disciplinario', label: 'Disciplinario' },
    { value: 'otro', label: 'Otro' },
  ];

  loading = signal(false);
  loadingParents = signal(false);
  loadingSlots = signal(false);
  loadingAvailability = signal(false);
  searching = signal(false);
  searchingParent = signal(false);
  errorMsg = signal('');

  parents = signal<ParentOfStudent[]>([]);
  searchResults = signal<AssignedStudent[]>([]);
  parentSearchResults = signal<SearchableParent[]>([]);
  selectedStudent = signal<AssignedStudent | null>(null);
  selectedParent = signal<SearchableParent | null>(null);
  studentSearchQuery = signal('');
  parentSearchQuery = signal('');
  includeStudent = signal(true);
  includeParent = signal(false);

  weekStart = signal<string>(getCurrentMonday());
  availability = signal<AccountAvailability[]>([]);
  slotsTaken = signal<SlotTaken[]>([]);
  picked = signal<PickedSlot[]>([]);

  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    return me ? (ruleForRol(me.rol, me.cargo) ?? APPOINTMENT_RULES.psicologa) : APPOINTMENT_RULES.psicologa;
  });

  readonly mySlotMinutes = computed(() => this.myRule().slotMinutes);
  readonly myAllowedDays = computed(() => this.myRule().allowedDays);
  readonly myStartHour = computed(() => ruleToStartHour(this.myRule()));
  readonly myEndHour = computed(() => ruleToEndHour(this.myRule()));
  readonly maxConsecutiveSlots = computed(() => ruleToMaxConsecutiveSlots(this.myRule()));
  readonly maxDurationMin = computed(() => this.myRule().maxDurationMin);

  readonly pickedSorted = computed(() =>
    [...this.picked()].sort((a, b) => a.hour.localeCompare(b.hour))
  );

  readonly durationMin = computed(() => this.picked().length * this.mySlotMinutes());

  readonly selectedSlots = computed<BookingSelectedSlot[]>(() =>
    this.picked().map(s => ({ dia: s.dia, hour: s.hour }))
  );

  readonly pickedLabel = computed<string | null>(() => {
    const sorted = this.pickedSorted();
    if (sorted.length === 0) return null;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const endHour = addMinutesToHour(last.hour, this.mySlotMinutes());
    return `${diaLabel(first.dia)} ${first.dateLabel} de ${first.hour} a ${endHour} (${this.durationMin()} min)`;
  });

  readonly availableStudents = computed<AssignedStudent[]>(() => {
    const term = this.studentSearchQuery().trim().toLowerCase();
    const seen = new Set<string>();
    const merged: AssignedStudent[] = [];
    for (const s of [...this.searchResults(), ...this.store.myStudents()]) {
      if (seen.has(s.id)) continue;
      const matches = !term || [s.nombre, s.apellido_paterno, s.apellido_materno ?? '', s.codigo_estudiante]
        .join(' ').toLowerCase().includes(term);
      if (!matches) continue;
      seen.add(s.id);
      merged.push(s);
    }
    return merged.slice(0, 25);
  });

  form: FormGroup = this.fb.group({
    studentId: [this.data.preselectedStudentId ?? ''],
    parentId: [''],
    tipo: ['psicologico', Validators.required],
    motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    date: [null as Date | null, Validators.required],
    time: ['', Validators.required],
    priorNotes: [''],
  });

  ngOnInit(): void {
    if (!this.store.myStudents().length) this.store.loadMyStudents();

    if (this.data.preselectedStudentId) {
      this.loadParents(this.data.preselectedStudentId);
      this.includeParent.set(true);
      const found = this.store.myStudents().find(s => s.id === this.data.preselectedStudentId);
      if (found) this.selectedStudent.set(found);
    }

    this.loadOwnAvailability();
    this.refreshSlotsTaken();
  }

  onWeekChange(weekStart: string): void {
    this.weekStart.set(weekStart);
    this.clearPicked();
    this.refreshSlotsTaken();
  }

  onSlotPick(ev: BookingPickEvent): void {
    const current = this.picked();
    const slotMin = this.mySlotMinutes();
    const newSlot: PickedSlot = {
      dia: ev.dia,
      hour: ev.hour,
      dateLabel: `${pad2(ev.date.getDate())}/${pad2(ev.date.getMonth() + 1)}`,
      date: ev.date,
    };

    if (current.length > 0 && current[0].dia !== ev.dia) {
      this.picked.set([newSlot]);
      this.errorMsg.set('');
      this.syncFormFromPicked();
      return;
    }

    if (current.some(s => s.hour === ev.hour)) {
      const sorted = this.pickedSorted();
      const idx = sorted.findIndex(s => s.hour === ev.hour);
      if (idx === 0 || idx === sorted.length - 1) {
        this.picked.set(current.filter(s => s.hour !== ev.hour));
        this.errorMsg.set('');
        this.syncFormFromPicked();
      }
      return;
    }

    if (current.length === 0) {
      this.picked.set([newSlot]);
      this.errorMsg.set('');
      this.syncFormFromPicked();
      return;
    }

    if (current.length >= this.maxConsecutiveSlots()) {
      this.errorMsg.set(`Máximo ${this.maxDurationMin()} minutos por cita.`);
      return;
    }

    const sorted = this.pickedSorted();
    const expectedBefore = addMinutesToHour(sorted[0].hour, -slotMin);
    const expectedAfter = addMinutesToHour(sorted[sorted.length - 1].hour, slotMin);

    if (ev.hour === expectedBefore || ev.hour === expectedAfter) {
      this.picked.set([...current, newSlot]);
    } else {
      this.picked.set([newSlot]);
    }
    this.errorMsg.set('');
    this.syncFormFromPicked();
  }

  clearPicked(): void {
    this.picked.set([]);
    this.form.patchValue({ date: null, time: '' });
  }

  private syncFormFromPicked(): void {
    const sorted = this.pickedSorted();
    if (sorted.length === 0) {
      this.form.patchValue({ date: null, time: '' });
      return;
    }
    this.form.patchValue({
      date: startOfDay(sorted[0].date),
      time: sorted[0].hour,
    });
  }

  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentFullName(p: SearchableParent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  async onSearchStudents(value: string): Promise<void> {
    this.studentSearchQuery.set(value);
    if (value.trim().length < 2) { this.searchResults.set([]); return; }
    this.searching.set(true);
    try {
      this.searchResults.set(await this.store.searchAllStudents(value.trim()));
    } catch {
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  onStudentSelected(student: AssignedStudent): void {
    this.selectedStudent.set(student);
    this.form.patchValue({ studentId: student.id });
  }

  clearStudent(): void {
    this.selectedStudent.set(null);
    this.searchResults.set([]);
    this.studentSearchQuery.set('');
    this.form.patchValue({ studentId: '' });
  }

  async onSearchParents(value: string): Promise<void> {
    this.parentSearchQuery.set(value);
    if (value.trim().length < 2) { this.parentSearchResults.set([]); return; }
    this.searchingParent.set(true);
    try {
      this.parentSearchResults.set(await this.store.searchAllParents(value.trim()));
    } catch {
      this.parentSearchResults.set([]);
    } finally {
      this.searchingParent.set(false);
    }
  }

  onParentSelected(parent: SearchableParent): void {
    this.selectedParent.set(parent);
    this.form.patchValue({ parentId: parent.id });
  }

  clearParent(): void {
    this.selectedParent.set(null);
    this.parentSearchResults.set([]);
    this.parentSearchQuery.set('');
    this.form.patchValue({ parentId: '' });
  }

  toggleIncludeStudent(checked: boolean): void {
    this.includeStudent.set(checked);
    if (!checked) { this.clearStudent(); if (!this.includeParent()) this.includeParent.set(true); }
  }

  toggleIncludeParent(checked: boolean): void {
    this.includeParent.set(checked);
    if (!checked) { this.clearParent(); if (!this.includeStudent()) this.includeStudent.set(true); }
  }

  private async loadOwnAvailability(): Promise<void> {
    const id = this.auth.currentUser()?.id;
    if (!id) return;
    this.loadingAvailability.set(true);
    try {
      this.availability.set(await this.appointmentsStore.getAvailability(id));
    } catch {
      this.availability.set([]);
    } finally {
      this.loadingAvailability.set(false);
    }
  }

  private async refreshSlotsTaken(): Promise<void> {
    const id = this.auth.currentUser()?.id;
    if (!id) return;
    this.loadingSlots.set(true);
    try {
      this.slotsTaken.set(await this.appointmentsStore.getSlotsTaken(id, this.weekStart()));
    } catch {
      this.slotsTaken.set([]);
    } finally {
      this.loadingSlots.set(false);
    }
  }

  private async loadParents(studentId: string): Promise<void> {
    this.loadingParents.set(true);
    try {
      const parents = await this.store.getStudentParents(studentId);
      this.parents.set(parents);
      if (parents.length === 1) this.form.patchValue({ parentId: parents[0].id });
    } catch {
      this.parents.set([]);
    } finally {
      this.loadingParents.set(false);
    }
  }

  cancel(): void { this.ref.close(false); }

  async submit(): Promise<void> {
    const hasStudent = this.includeStudent() && !!this.form.value.studentId;
    const hasParent = this.includeParent() && !!this.form.value.parentId;

    if (!hasStudent && !hasParent) {
      this.errorMsg.set('Debe seleccionar al menos un alumno o un padre/tutor.');
      return;
    }
    if (this.picked().length === 0) {
      this.errorMsg.set('Debe seleccionar al menos un horario.');
      return;
    }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const psicologaId = this.auth.currentUser()?.id;
    if (!psicologaId) { this.errorMsg.set('Sesión inválida.'); return; }

    const v = this.form.value;
    const scheduled = combineDateAndTime(v.date as Date, v.time as string);
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000) {
      this.errorMsg.set(`La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`);
      return;
    }

    const convocadoAId = hasParent ? v.parentId : v.studentId;
    if (convocadoAId === psicologaId) { this.errorMsg.set('No puedes convocarte a ti misma.'); return; }

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      await this.appointmentsStore.createAppointment({
        convocadoAId,
        studentId: hasStudent ? v.studentId : undefined,
        parentId: hasParent ? v.parentId : undefined,
        tipo: v.tipo,
        motivo: v.motivo,
        scheduledAt: scheduled.toISOString(),
        durationMin: this.durationMin(),
        priorNotes: v.priorNotes || undefined,
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

export { parseApiError } from '../../../../shared/utils/api-errors';