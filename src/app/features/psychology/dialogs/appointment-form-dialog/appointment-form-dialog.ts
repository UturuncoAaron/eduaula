import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
import {
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  from,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { ToastService } from 'ngx-toastr-notifier';

import {
  BookingCalendar,
  BookingPickEvent,
  BookingSelectedSlot,
} from '../../../../shared/components/booking-calendar/booking-calendar';
import {
  combineDateAndTime,
  diaLabel,
  getCurrentMonday,
  pad2,
  startOfDay,
} from '../../../../shared/utils/calendar-week';
import { parseApiError } from '../../../../shared/utils/api-errors';
import { PsychologyStore } from '../../data-access/psychology.store';
import { AppointmentsStore } from '../../../appointments/data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import {
  AccountAvailability,
  AppointmentTipo,
  DiaSemana,
  SlotTaken,
  APPOINTMENT_RULES,
  ruleForRol,
  ruleToEndHour,
  ruleToMaxConsecutiveSlots,
  ruleToStartHour,
} from '../../../../core/models/appointments';
import {
  AssignedStudent,
  SearchableParent,
} from '../../../../core/models/psychology';

// ── Tipos locales ────────────────────────────────────────────────
export interface AppointmentFormDialogData {
  preselectedStudentId?: string;
}

interface PickedSlot {
  dia: DiaSemana;
  hour: string;
  dateLabel: string;
  date: Date;
}

// ── Constantes ───────────────────────────────────────────────────
const MIN_LEAD_MINUTES = 15;

function addMinutesToHour(hour: string, minutes: number): string {
  const [h, m] = hour.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

// ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    TitleCasePipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTooltipModule,
    BookingCalendar,
  ],
  templateUrl: './appointment-form-dialog.html',
  styleUrl: './appointment-form-dialog.scss',
})
export class AppointmentFormDialog implements OnInit {

  // ── Inyecciones ──────────────────────────────────────────────
  readonly data = inject<AppointmentFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AppointmentFormDialog>);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly store = inject(PsychologyStore);
  readonly appointmentsStore = inject(AppointmentsStore);

  // ── Catálogo de tipos ────────────────────────────────────────
  readonly tipos: { value: AppointmentTipo; label: string; icon: string }[] = [
    { value: 'academico', label: 'Académico', icon: 'menu_book' },
    { value: 'conductual', label: 'Conductual', icon: 'psychology_alt' },
    { value: 'psicologico', label: 'Psicológico', icon: 'self_improvement' },
    { value: 'familiar', label: 'Familiar', icon: 'family_restroom' },
    { value: 'disciplinario', label: 'Disciplinario', icon: 'gavel' },
    { value: 'otro', label: 'Otro', icon: 'more_horiz' },
  ];

  // ── Estados de UI ────────────────────────────────────────────
  readonly loading = signal(false);
  readonly loadingParents = signal(false);
  readonly loadingSlots = signal(false);
  readonly loadingAvailability = signal(false);
  readonly searching = signal(false);
  readonly searchingParent = signal(false);
  readonly errorMsg = signal('');

  // ── Participantes ────────────────────────────────────────────
  readonly selectedStudent = signal<AssignedStudent | null>(null);
  readonly selectedParent = signal<SearchableParent | null>(null);
  readonly includeStudent = signal(true);
  readonly includeParent = signal(false);

  // ── Búsqueda — FormControls para que mat-autocomplete funcione
  // (con signals + OnPush el overlay no detecta cambios)
  readonly studentSearchCtrl = new FormControl('');
  readonly parentSearchCtrl = new FormControl('');

  // ── Streams de búsqueda (Observable → async pipe en template) ─
  readonly students$: Observable<AssignedStudent[]> =
    this.studentSearchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter((v): v is string => typeof v === 'string'),
      switchMap(term => {
        const t = term.trim();
        if (t.length < 2) {
          this.searching.set(false);
          return of([] as AssignedStudent[]);
        }
        this.searching.set(true);
        return from(this.store.searchAllStudents(t)).pipe(
          catchError(() => of([] as AssignedStudent[])),
        );
      }),
      tap(() => this.searching.set(false)),
      startWith([] as AssignedStudent[]),
      shareReplay(1),
    );

  readonly parents$: Observable<SearchableParent[]> =
    this.parentSearchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter((v): v is string => typeof v === 'string'),
      switchMap(term => {
        const t = term.trim();
        if (t.length < 2) {
          this.searchingParent.set(false);
          return of([] as SearchableParent[]);
        }
        this.searchingParent.set(true);
        return from(this.store.searchAllParents(t)).pipe(
          catchError(() => of([] as SearchableParent[])),
        );
      }),
      tap(() => this.searchingParent.set(false)),
      startWith([] as SearchableParent[]),
      shareReplay(1),
    );

  // ── Calendario ───────────────────────────────────────────────
  readonly weekStart = signal<string>(getCurrentMonday());
  readonly availability = signal<AccountAvailability[]>([]);
  readonly slotsTaken = signal<SlotTaken[]>([]);
  readonly picked = signal<PickedSlot[]>([]);

  // ── Reglas del rol ───────────────────────────────────────────
  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    return me
      ? (ruleForRol(me.rol, me.cargo) ?? APPOINTMENT_RULES.psicologa)
      : APPOINTMENT_RULES.psicologa;
  });

  readonly mySlotMinutes = computed(() => this.myRule().slotMinutes);
  readonly myAllowedDays = computed(() => this.myRule().allowedDays);
  readonly myStartHour = computed(() => ruleToStartHour(this.myRule()));
  readonly myEndHour = computed(() => ruleToEndHour(this.myRule()));
  readonly maxConsecutiveSlots = computed(() => ruleToMaxConsecutiveSlots(this.myRule()));
  readonly maxDurationMin = computed(() => this.myRule().maxDurationMin);

  // ── Slots seleccionados ──────────────────────────────────────
  readonly pickedSorted = computed(() =>
    [...this.picked()].sort((a, b) => a.hour.localeCompare(b.hour)),
  );
  readonly durationMin = computed(() =>
    this.picked().length * this.mySlotMinutes(),
  );
  readonly selectedSlots = computed<BookingSelectedSlot[]>(() =>
    this.picked().map(s => ({ dia: s.dia, hour: s.hour })),
  );
  readonly pickedLabel = computed<string | null>(() => {
    const sorted = this.pickedSorted();
    if (!sorted.length) return null;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const endHour = addMinutesToHour(last.hour, this.mySlotMinutes());
    return `${diaLabel(first.dia)} ${first.dateLabel} · ${first.hour} – ${endHour} (${this.durationMin()} min)`;
  });

  // ── Formulario principal ─────────────────────────────────────
  readonly form: FormGroup = this.fb.group({
    studentId: [this.data.preselectedStudentId ?? ''],
    parentId: [''],
    tipo: ['psicologico', Validators.required],
    motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    date: [null as Date | null, Validators.required],
    time: ['', Validators.required],
    priorNotes: [''],
  });

  // ── Ciclo de vida ────────────────────────────────────────────
  ngOnInit(): void {
    if (!this.store.myStudents().length) this.store.loadMyStudents();

    if (this.data.preselectedStudentId) {
      this.includeParent.set(true);
      this.loadParents(this.data.preselectedStudentId);
      const found = this.store.myStudents()
        .find(s => s.id === this.data.preselectedStudentId);
      if (found) this.selectedStudent.set(found);
    }

    this.loadOwnAvailability();
    this.refreshSlotsTaken();
  }

  // ── Participantes ────────────────────────────────────────────
  toggleIncludeStudent(checked: boolean): void {
    this.includeStudent.set(checked);
    if (!checked) {
      this.clearStudent();
      if (!this.includeParent()) this.includeParent.set(true);
    }
  }

  toggleIncludeParent(checked: boolean): void {
    this.includeParent.set(checked);
    if (!checked) {
      this.clearParent();
      if (!this.includeStudent()) this.includeStudent.set(true);
    }
  }

  onStudentSelected(student: AssignedStudent): void {
    this.selectedStudent.set(student);
    this.form.patchValue({ studentId: student.id });
    this.studentSearchCtrl.setValue('', { emitEvent: false });
  }

  clearStudent(): void {
    this.selectedStudent.set(null);
    this.studentSearchCtrl.setValue('', { emitEvent: false });
    this.form.patchValue({ studentId: '' });
  }

  onParentSelected(parent: SearchableParent): void {
    this.selectedParent.set(parent);
    this.form.patchValue({ parentId: parent.id });
    this.parentSearchCtrl.setValue('', { emitEvent: false });
  }

  clearParent(): void {
    this.selectedParent.set(null);
    this.parentSearchCtrl.setValue('', { emitEvent: false });
    this.form.patchValue({ parentId: '' });
  }

  // ── Calendario ───────────────────────────────────────────────
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

    // Día distinto → reiniciar
    if (current.length > 0 && current[0].dia !== ev.dia) {
      this.picked.set([newSlot]);
      this.errorMsg.set('');
      this.syncFormFromPicked();
      return;
    }

    // Toggle: deseleccionar solo extremos del rango
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

    // Primer slot
    if (!current.length) {
      this.picked.set([newSlot]);
      this.errorMsg.set('');
      this.syncFormFromPicked();
      return;
    }

    // Límite máximo
    if (current.length >= this.maxConsecutiveSlots()) {
      this.errorMsg.set(`Máximo ${this.maxDurationMin()} minutos por cita.`);
      return;
    }

    // Solo adyacente al rango actual
    const sorted = this.pickedSorted();
    const expectedBefore = addMinutesToHour(sorted[0].hour, -slotMin);
    const expectedAfter = addMinutesToHour(sorted[sorted.length - 1].hour, slotMin);

    this.picked.set(
      ev.hour === expectedBefore || ev.hour === expectedAfter
        ? [...current, newSlot]
        : [newSlot],
    );
    this.errorMsg.set('');
    this.syncFormFromPicked();
  }

  clearPicked(): void {
    this.picked.set([]);
    this.form.patchValue({ date: null, time: '' });
  }

  // ── Presentación ─────────────────────────────────────────────
  fullName(s: AssignedStudent): string {
    return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
  }

  parentFullName(p: SearchableParent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  /** Devuelve '' para que el input quede limpio al seleccionar una opción */
  displayFn(): string { return ''; }

  // ── Acciones de diálogo ──────────────────────────────────────
  cancel(): void { this.ref.close(false); }

  async submit(): Promise<void> {
    const hasStudent = this.includeStudent() && !!this.form.value.studentId;
    const hasParent = this.includeParent() && !!this.form.value.parentId;

    if (!hasStudent && !hasParent) {
      this.errorMsg.set('Selecciona al menos un alumno o un padre/tutor.');
      return;
    }
    if (!this.picked().length) {
      this.errorMsg.set('Selecciona al menos un horario disponible.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const psicologaId = this.auth.currentUser()?.id;
    if (!psicologaId) { this.errorMsg.set('Sesión inválida.'); return; }

    const v = this.form.value;
    const scheduled = combineDateAndTime(v.date as Date, v.time as string);

    if (Number.isNaN(scheduled.getTime()) ||
      scheduled.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000) {
      this.errorMsg.set(
        `La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`,
      );
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
        durationMin: this.durationMin(),
        priorNotes: v.priorNotes || undefined,
      });
      this.toast.success('Cita programada correctamente');
      this.ref.close(true);
    } catch (err: unknown) {
      this.errorMsg.set(parseApiError(err, 'No se pudo crear la cita'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Privados ─────────────────────────────────────────────────
  private syncFormFromPicked(): void {
    const sorted = this.pickedSorted();
    if (!sorted.length) {
      this.form.patchValue({ date: null, time: '' });
      return;
    }
    this.form.patchValue({
      date: startOfDay(sorted[0].date),
      time: sorted[0].hour,
    });
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
      this.slotsTaken.set(
        await this.appointmentsStore.getSlotsTaken(id, this.weekStart()),
      );
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
      if (parents.length === 1) {
        this.form.patchValue({ parentId: parents[0].id });
      }
    } catch {
      // silencioso — no bloquea el flujo principal
    } finally {
      this.loadingParents.set(false);
    }
  }
}