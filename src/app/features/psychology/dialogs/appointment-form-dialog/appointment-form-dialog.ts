import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { TitleCasePipe } from '@angular/common';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  from,
  of,
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
  ParentOfStudent,
  SearchableParent,
} from '../../../../core/models/psychology';

export interface AppointmentFormDialogData {
  preselectedStudentId?: string;
}

interface PickedSlot {
  dia: DiaSemana;
  hour: string;
  dateLabel: string;
  date: Date;
}

const MIN_LEAD_MINUTES = 15;

function addMinutesToHour(hour: string, minutes: number): string {
  const [h, m] = hour.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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

  readonly data = inject<AppointmentFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AppointmentFormDialog>);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly store = inject(PsychologyStore);
  readonly appointmentsStore = inject(AppointmentsStore);

  readonly tipos: { value: AppointmentTipo; label: string; icon: string }[] = [
    { value: 'academico', label: 'Académico', icon: 'menu_book' },
    { value: 'conductual', label: 'Conductual', icon: 'psychology_alt' },
    { value: 'psicologico', label: 'Psicológico', icon: 'self_improvement' },
    { value: 'familiar', label: 'Familiar', icon: 'family_restroom' },
    { value: 'disciplinario', label: 'Disciplinario', icon: 'gavel' },
    { value: 'otro', label: 'Otro', icon: 'more_horiz' },
  ];

  // ── UI state ──────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly loadingParents = signal(false);
  readonly loadingSlots = signal(false);
  readonly loadingAvailability = signal(false);
  readonly searching = signal(false);
  readonly searchingParent = signal(false);
  readonly errorMsg = signal('');

  // ── Participantes ─────────────────────────────────────────────
  readonly selectedStudent = signal<AssignedStudent | null>(null);
  readonly selectedParent = signal<SearchableParent | null>(null);
  readonly includeStudent = signal(true);
  readonly includeParent = signal(false);

  /**
   * Padres vinculados al alumno actualmente seleccionado. Se hidrata
   * automáticamente cuando la psicóloga elige un alumno (búsqueda
   * inteligente). Cuando hay 2+, exponemos checkboxes para elegir uno o
   * ambos.
   */
  readonly linkedParents = signal<ParentOfStudent[]>([]);
  /** IDs de padres vinculados que el usuario seleccionó (puede ser más de uno). */
  readonly selectedLinkedParentIds = signal<readonly string[]>([]);

  readonly hasLinkedParents = computed(() => this.linkedParents().length > 0);

  // FormControls para que mat-autocomplete detecte cambios
  readonly studentSearchCtrl = new FormControl('');
  readonly parentSearchCtrl = new FormControl('');

  // ── Búsqueda como signals ─────────────────────────────────────
  // toSignal() propaga cambios al CDK overlay portal donde vive el
  // panel de mat-autocomplete, lo que el async pipe + OnPush no logra
  // en Angular 18+.

  readonly students = toSignal(
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
    ),
    { initialValue: [] as AssignedStudent[] },
  );

  readonly parents = toSignal(
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
    ),
    { initialValue: [] as SearchableParent[] },
  );

  // ── Calendario ────────────────────────────────────────────────
  readonly weekStart = signal<string>(getCurrentMonday());
  readonly availability = signal<AccountAvailability[]>([]);
  readonly slotsTaken = signal<SlotTaken[]>([]);
  readonly picked = signal<PickedSlot[]>([]);

  // ── Reglas del rol ────────────────────────────────────────────
  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    return me
      ? (ruleForRol(me.rol) ?? APPOINTMENT_RULES.psicologa)
      : APPOINTMENT_RULES.psicologa;
  });

  readonly mySlotMinutes = computed(() => this.myRule().slotMinutes);
  readonly myAllowedDays = computed(() => this.myRule().allowedDays);
  readonly myStartHour = computed(() => ruleToStartHour(this.myRule()));
  readonly myEndHour = computed(() => ruleToEndHour(this.myRule()));
  readonly maxConsecutiveSlots = computed(() => ruleToMaxConsecutiveSlots(this.myRule()));
  readonly maxDurationMin = computed(() => this.myRule().maxDurationMin);

  // ── Selección de slots ────────────────────────────────────────
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

  // ── Formulario ────────────────────────────────────────────────
  readonly form: FormGroup = this.fb.group({
    studentId: [this.data.preselectedStudentId ?? ''],
    parentId: [''],
    tipo: ['psicologico', Validators.required],
    motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    date: [null as Date | null, Validators.required],
    time: ['', Validators.required],
    priorNotes: [''],
  });

  // ── Ciclo de vida ─────────────────────────────────────────────
  ngOnInit(): void {
    if (!this.store.myStudents().length) this.store.loadMyStudents();

    if (this.data.preselectedStudentId) {
      this.loadParents(this.data.preselectedStudentId);
      const found = this.store.myStudents().find(s => s.id === this.data.preselectedStudentId);
      if (found) this.selectedStudent.set(found);
    }

    this.loadOwnAvailability();
    this.refreshSlotsTaken();
  }

  // ── Participantes ─────────────────────────────────────────────
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
    // CAPTURA DEL ID + PAYLOAD COMPLETO. Antes el form sólo guardaba
    // `studentId` y el resto de los campos del alumno se quedaban en el
    // signal `selectedStudent`. Si por alguna razón se reseteaba el signal
    // pero el form ya tenía el id, la cita se enviaba con datos vacíos en
    // el front (avatar, nombre, grado). Reasignamos siempre el objeto
    // entero para garantizar consistencia.
    this.selectedStudent.set(student);
    this.form.patchValue({ studentId: student.id });
    this.studentSearchCtrl.setValue('', { emitEvent: false });

    // Búsqueda inteligente: al elegir un alumno, traé sus padres
    // vinculados del backend (sin importar si el modal trajo o no
    // `preselectedStudentId`).
    this.linkedParents.set([]);
    this.selectedLinkedParentIds.set([]);
    this.clearParent();
    void this.fetchAndApplyLinkedParents(student.id);
  }

  clearStudent(): void {
    this.selectedStudent.set(null);
    this.studentSearchCtrl.setValue('', { emitEvent: false });
    this.form.patchValue({ studentId: '' });
    this.linkedParents.set([]);
    this.selectedLinkedParentIds.set([]);
  }

  /** Marca/desmarca un padre vinculado al alumno (checkboxes múltiples). */
  toggleLinkedParent(parentId: string, checked: boolean): void {
    const current = this.selectedLinkedParentIds();
    if (checked) {
      if (!current.includes(parentId)) {
        this.selectedLinkedParentIds.set([...current, parentId]);
      }
    } else {
      this.selectedLinkedParentIds.set(current.filter(id => id !== parentId));
    }
    // Mantenemos `includeParent` activo cuando hay al menos un padre marcado
    // y sincronizamos `parentId` del form con el PRIMERO seleccionado para
    // que el submit base siga funcionando (los demás se crean en paralelo).
    const next = this.selectedLinkedParentIds();
    if (next.length > 0) {
      this.includeParent.set(true);
      this.form.patchValue({ parentId: next[0] });
    } else {
      this.form.patchValue({ parentId: '' });
      this.includeParent.set(false);
    }
  }

  isLinkedParentSelected(parentId: string): boolean {
    return this.selectedLinkedParentIds().includes(parentId);
  }

  linkedParentLabel(p: ParentOfStudent): string {
    const rel = p.relacion ? ` (${p.relacion})` : '';
    return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + rel;
  }

  onParentSelected(parent: SearchableParent): void {
    this.selectedParent.set(parent);
    this.form.patchValue({ parentId: parent.id });
    this.parentSearchCtrl.setValue('', { emitEvent: false });
  }

  clearParent(): void {
    this.selectedParent.set(null);
    this.selectedLinkedParentIds.set([]);
    this.parentSearchCtrl.setValue('', { emitEvent: false });
    this.form.patchValue({ parentId: '' });
  }

  // ── Calendario ────────────────────────────────────────────────
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

    if (!current.length) {
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

  // Retorna '' para limpiar el input al seleccionar una opción
  readonly displayFn = (): string => '';

  cancel(): void { this.ref.close(false); }

  async submit(): Promise<void> {
    const hasStudent = this.includeStudent() && !!this.form.value.studentId;

    // Decidimos qué padres usaremos: si la psicóloga viene de la búsqueda
    // inteligente y eligió 2+ padres vinculados, creamos UNA cita por
    // cada uno. Si no, caemos al flujo original con `parentId` del form.
    const linkedIds = this.selectedLinkedParentIds();
    const parentIdsToInvite: string[] = this.includeParent()
      ? (linkedIds.length > 0
        ? [...linkedIds]
        : (this.form.value.parentId ? [this.form.value.parentId] : []))
      : [];
    const hasParent = parentIdsToInvite.length > 0;

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
      this.errorMsg.set(`La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`);
      return;
    }

    if (parentIdsToInvite.includes(psicologaId) || v.studentId === psicologaId) {
      this.errorMsg.set('No puedes convocarte a ti misma.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');
    try {
      if (parentIdsToInvite.length > 1) {
        // 2+ padres vinculados → una cita por padre, todas con el mismo
        // alumno, fecha, motivo y duración. Si una falla, registramos el
        // error pero seguimos con las demás.
        const results = await Promise.allSettled(
          parentIdsToInvite.map(parentId =>
            this.appointmentsStore.createAppointment({
              convocadoAId: parentId,
              studentId: hasStudent ? v.studentId : undefined,
              parentId,
              tipo: v.tipo,
              motivo: v.motivo,
              scheduledAt: scheduled.toISOString(),
              durationMin: this.durationMin(),
              priorNotes: v.priorNotes || undefined,
            }),
          ),
        );
        const okCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.length - okCount;
        if (okCount > 0 && failCount === 0) {
          this.toast.success(`Citas programadas para ${okCount} padres/tutores`);
          this.ref.close(true);
        } else if (okCount > 0) {
          this.toast.info(
            `${okCount} cita(s) creadas, ${failCount} fallaron. Revisa la agenda y reintenta las pendientes.`,
            undefined, { duration: 8000 },
          );
          this.ref.close(true);
        } else {
          // Todas fallaron — mostramos el error del primero
          const first = results[0];
          this.errorMsg.set(
            first.status === 'rejected'
              ? parseApiError(first.reason, 'No se pudo crear la cita')
              : 'No se pudo crear la cita',
          );
        }
      } else {
        const convocadoAId = hasParent ? parentIdsToInvite[0] : v.studentId;
        const created = await this.appointmentsStore.createAppointment({
          convocadoAId,
          studentId: hasStudent ? v.studentId : undefined,
          parentId: hasParent ? parentIdsToInvite[0] : undefined,
          tipo: v.tipo,
          motivo: v.motivo,
          scheduledAt: scheduled.toISOString(),
          durationMin: this.durationMin(),
          priorNotes: v.priorNotes || undefined,
        });

        // El BE puede devolver `availableParents` cuando la psicóloga citó
        // al alumno y existían varios padres. La cita ya quedó creada con
        // el primer padre — aquí informamos para que la usuaria pueda
        // recrearla si necesita el otro padre.
        if (created.availableParents && created.availableParents.length > 1 && !hasParent) {
          const names = created.availableParents
            .map(p => `${p.nombre} ${p.apellido_paterno}`).join(', ');
          this.toast.info(
            `Cita programada · El alumno tiene ${created.availableParents.length} padres registrados (${names}). Se vinculó al primero — si necesitas cambiarlo, créala de nuevo seleccionando el padre.`,
            undefined, { duration: 8000 },
          );
        } else {
          this.toast.success('Cita programada correctamente');
        }
        this.ref.close(true);
      }
    } catch (err: unknown) {
      this.errorMsg.set(parseApiError(err, 'No se pudo crear la cita'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Privados ──────────────────────────────────────────────────
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

  // `loadParents` se reemplaza por `fetchAndApplyLinkedParents`, más
  // explicativo sobre el comportamiento UI. Mantenemos esta firma por
  // compatibilidad con el código original.
  private async loadParents(studentId: string): Promise<void> {
    return this.fetchAndApplyLinkedParents(studentId);
  }

  /**
   * Trae los padres del alumno para que la UI los liste sin invitarlos por defecto.
   */
  private async fetchAndApplyLinkedParents(studentId: string): Promise<void> {
    this.loadingParents.set(true);
    try {
      const parents = await this.store.getStudentParents(studentId);
      this.linkedParents.set(parents);
      this.selectedLinkedParentIds.set([]);
      this.selectedParent.set(null);
      this.form.patchValue({ parentId: '' });
    } catch {
      this.linkedParents.set([]);
    } finally {
      this.loadingParents.set(false);
    }
  }
}