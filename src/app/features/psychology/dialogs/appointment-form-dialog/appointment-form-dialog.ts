import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import {
  FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
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
  BookingCalendar, BookingPickEvent,
} from '../../../../shared/components/booking-calendar/booking-calendar';
import {
  combineDateAndTime, diaLabel, getCurrentMonday, pad2, startOfDay,
} from '../../../../shared/utils/calendar-week';
import { parseApiError } from '../../../../shared/utils/api-errors';

import { PsychologyStore } from '../../data-access/psychology.store';
import { AppointmentsStore } from '../../../appointments/data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import {
  AccountAvailability, AppointmentTipo, DiaSemana, SlotTaken,
} from '../../../../core/models/appointments';
import {
  AssignedStudent, ParentOfStudent, SearchableParent,
} from '../../../../core/models/psychology';

export interface AppointmentFormDialogData {
  preselectedStudentId?: string;
}

const MIN_LEAD_MINUTES = 15;

interface PickedSlot {
  dia: DiaSemana;
  hour: string;
  endHour: string;
  durationMin: number;
  dateLabel: string;
}

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatAutocompleteModule, MatTooltipModule,
    BookingCalendar,
  ],
  templateUrl: './appointment-form-dialog.html',
  styleUrl: './appointment-form-dialog.scss',
})
export class AppointmentFormDialog implements OnInit {

  // Inyecciones
  readonly data: AppointmentFormDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AppointmentFormDialog>);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);
  readonly store = inject(PsychologyStore);
  readonly appointmentsStore = inject(AppointmentsStore);

  // Catalogos
  readonly tipos: { value: AppointmentTipo; label: string; icon: string }[] = [
    { value: 'academico', label: 'Academico', icon: 'menu_book' },
    { value: 'conductual', label: 'Conductual', icon: 'psychology_alt' },
    { value: 'psicologico', label: 'Psicologico', icon: 'psychology' },
    { value: 'familiar', label: 'Familiar', icon: 'family_restroom' },
    { value: 'disciplinario', label: 'Disciplinario', icon: 'gavel' },
    { value: 'otro', label: 'Otro', icon: 'more_horiz' },
  ];

  // Estado UI
  loading = signal(false);
  loadingParents = signal(false);
  loadingSlots = signal(false);
  loadingAvailability = signal(false);
  searching = signal(false);
  searchingParent = signal(false);
  errorMsg = signal('');

  // Participantes
  parents = signal<ParentOfStudent[]>([]);
  searchResults = signal<AssignedStudent[]>([]);
  parentSearchResults = signal<SearchableParent[]>([]);
  selectedStudent = signal<AssignedStudent | null>(null);
  selectedParent = signal<SearchableParent | null>(null);
  studentSearchQuery = signal('');
  parentSearchQuery = signal('');
  includeStudent = signal(true);
  includeParent = signal(false);

  // Calendario
  weekStart = signal<string>(getCurrentMonday());
  availability = signal<AccountAvailability[]>([]);
  slotsTaken = signal<SlotTaken[]>([]);
  picked = signal<PickedSlot | null>(null);

  readonly pickedLabel = computed<string | null>(() => {
    const p = this.picked();
    if (!p) return null;
    return `${diaLabel(p.dia)} ${p.dateLabel} - ${p.hour} hasta ${p.endHour} (${p.durationMin} min)`;
  });

  readonly availableStudents = computed<AssignedStudent[]>(() => {
    const search = this.searchResults();
    const mine = this.store.myStudents();
    const term = this.studentSearchQuery().trim().toLowerCase();
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

  // Form — date/time/durationMin se llenan desde el calendario, no hay inputs manuales
  form: FormGroup = this.fb.group({
    studentId: [this.data?.preselectedStudentId ?? ''],
    parentId: [''],
    tipo: ['psicologico', [Validators.required]],
    motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    date: [null as Date | null, [Validators.required]],
    time: ['', [Validators.required]],
    durationMin: [30, [Validators.required, Validators.min(15), Validators.max(180)]],
    priorNotes: [''],
  });

  ngOnInit(): void {
    if (this.store.myStudents().length === 0) this.store.loadMyStudents();

    if (this.data?.preselectedStudentId) {
      this.loadParents(this.data.preselectedStudentId);
      this.includeParent.set(true);
      const found = this.store.myStudents().find(s => s.id === this.data.preselectedStudentId);
      if (found) this.selectedStudent.set(found);
    }

    this.loadOwnAvailability();
    this.refreshSlotsTaken();
  }

  // Calendario
  onWeekChange(weekStart: string): void {
    this.weekStart.set(weekStart);
    this.clearPicked();
    this.refreshSlotsTaken();
  }

  onSlotPick(ev: BookingPickEvent): void {
    this.picked.set({
      dia: ev.dia,
      hour: ev.hour,
      endHour: ev.endHour,
      durationMin: ev.durationMin,
      dateLabel: `${pad2(ev.date.getDate())}/${pad2(ev.date.getMonth() + 1)}`,
    });
    this.form.patchValue({
      date: startOfDay(ev.date),
      time: ev.hour,
      durationMin: ev.durationMin,
    });
  }

  onCalendarClear(): void {
    this.clearPicked();
  }

  clearPicked(): void {
    this.picked.set(null);
    this.form.patchValue({ date: null, time: '', durationMin: 30 });
  }

  // Helpers
  initials(nombre: string, apellido: string): string {
    return `${nombre?.charAt(0) ?? ''}${apellido?.charAt(0) ?? ''}`.toUpperCase();
  }

  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentName(p: ParentOfStudent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  parentFullName(p: SearchableParent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  // Busqueda alumnos
  async onSearchStudents(value: string): Promise<void> {
    this.studentSearchQuery.set(value);
    const term = value.trim();
    if (term.length < 2) { this.searchResults.set([]); return; }
    this.searching.set(true);
    try { this.searchResults.set(await this.store.searchAllStudents(term)); }
    catch { this.searchResults.set([]); }
    finally { this.searching.set(false); }
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

  // Busqueda padres
  async onSearchParents(value: string): Promise<void> {
    this.parentSearchQuery.set(value);
    const term = value.trim();
    if (term.length < 2) { this.parentSearchResults.set([]); return; }
    this.searchingParent.set(true);
    try { this.parentSearchResults.set(await this.store.searchAllParents(term)); }
    catch { this.parentSearchResults.set([]); }
    finally { this.searchingParent.set(false); }
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

  // Carga remota
  private async loadOwnAvailability(): Promise<void> {
    const profId = this.auth.currentUser()?.id;
    if (!profId) return;
    this.loadingAvailability.set(true);
    try { this.availability.set(await this.appointmentsStore.getAvailability(profId)); }
    catch { this.availability.set([]); }
    finally { this.loadingAvailability.set(false); }
  }

  private async refreshSlotsTaken(): Promise<void> {
    const profId = this.auth.currentUser()?.id;
    if (!profId) return;
    this.loadingSlots.set(true);
    try { this.slotsTaken.set(await this.appointmentsStore.getSlotsTaken(profId, this.weekStart())); }
    catch { this.slotsTaken.set([]); }
    finally { this.loadingSlots.set(false); }
  }

  private async loadParents(studentId: string): Promise<void> {
    this.loadingParents.set(true);
    try {
      const parents = await this.store.getStudentParents(studentId);
      this.parents.set(parents);
      if (parents.length === 1) this.form.patchValue({ parentId: parents[0].id });
    } catch { this.parents.set([]); }
    finally { this.loadingParents.set(false); }
  }

  // Submit
  cancel(): void { this.ref.close(false); }

  async submit(): Promise<void> {
    const hasStudent = this.includeStudent() && !!this.form.value.studentId;
    const hasParent = this.includeParent() && !!this.form.value.parentId;

    if (!hasStudent && !hasParent) {
      this.errorMsg.set('Debe seleccionar al menos un alumno o un padre/tutor.');
      return;
    }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const psicologaId = this.auth.currentUser()?.id;
    if (!psicologaId) { this.errorMsg.set('Sesion invalida.'); return; }

    const v = this.form.value;
    const scheduled = combineDateAndTime(v.date as Date, v.time as string);
    const minStart = Date.now() + MIN_LEAD_MINUTES * 60_000;

    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < minStart) {
      this.errorMsg.set(`La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} min de anticipacion.`);
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
      await this.appointmentsStore.createAppointment({
        convocadoAId,
        studentId: hasStudent ? v.studentId : undefined,
        parentId: hasParent ? v.parentId : undefined,
        tipo: v.tipo,
        motivo: v.motivo,
        scheduledAt: scheduled.toISOString(),
        durationMin: v.durationMin,
        priorNotes: v.priorNotes || undefined,
      });
      this.toastr.success('Cita programada correctamente');
      this.ref.close(true);
    } catch (err: unknown) {
      this.errorMsg.set(parseApiError(err, 'No se pudo crear la cita'));
    } finally {
      this.loading.set(false);
    }
  }
}

export { parseApiError } from '../../../../shared/utils/api-errors';