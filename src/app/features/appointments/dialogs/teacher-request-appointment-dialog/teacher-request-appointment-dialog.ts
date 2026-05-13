import {
  ChangeDetectionStrategy, Component, OnInit,
  computed, inject, signal,
} from '@angular/core';
import {
  FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  MatDialog, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'ngx-toastr-notifier';

import {
  BookingCalendar, BookingPickEvent,
} from '../../../../shared/components/booking-calendar/booking-calendar';
import {
  ConfirmDialog, ConfirmData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog';

import { AppointmentsStore, StudentSearchResult } from '../../data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import {
  AccountAvailability, AppointmentTipo, DiaSemana, SlotTaken,
  APPOINTMENT_RULES, ruleForRol,
  ruleToStartHour, ruleToEndHour, ruleToSlotMinutes,
} from '../../../../core/models/appointments';
import {
  combineDateAndTime, diaLabel, getCurrentMonday,
  pad2, startOfDay,
} from '../../../../shared/utils/calendar-week';
import { parseApiError } from '../../../../shared/utils/api-errors';

const MIN_LEAD_MINUTES = 15;

type StudentOption = StudentSearchResult;

interface PickedSlot {
  dia: DiaSemana;
  hour: string;
  dateLabel: string;
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
    MatProgressSpinnerModule, MatTooltipModule,
    BookingCalendar,
  ],
  templateUrl: './teacher-request-appointment-dialog.html',
  styleUrl: './teacher-request-appointment-dialog.scss',
})
export class TeacherRequestAppointmentDialog implements OnInit {
  private ref = inject(MatDialogRef<TeacherRequestAppointmentDialog>);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private store = inject(AppointmentsStore);
  private auth = inject(AuthService);
  private toastr = inject(ToastService);

  // ── Catálogos ───────────────────────────────────────────────
  readonly tipos: { value: AppointmentTipo; label: string }[] = [
    { value: 'academico', label: 'Académico' },
    { value: 'conductual', label: 'Conductual' },
    { value: 'familiar', label: 'Familiar' },
    { value: 'disciplinario', label: 'Disciplinario' },
    { value: 'otro', label: 'Otro' },
  ];

  // ── UI state ────────────────────────────────────────────────
  loading = signal(false);
  errorMsg = signal('');

  // Autocomplete alumno
  searching = signal(false);
  students = signal<StudentOption[]>([]);
  selected = signal<StudentOption | null>(null);

  // Calendario booking de MI propia disponibilidad
  loadingAvailability = signal(false);
  loadingSlots = signal(false);
  weekStart = signal<string>(getCurrentMonday());
  availability = signal<AccountAvailability[]>([]);
  slotsTaken = signal<SlotTaken[]>([]);
  picked = signal<PickedSlot | null>(null);

  readonly parentLabel = computed<string>(() => {
    const s = this.selected();
    if (!s?.padre) return '';
    return `${s.padre.nombre} ${s.padre.apellido_paterno}`.trim();
  });

  /** "5° A" o '' si todavía no hay matrícula activa. */
  readonly gradoSeccionLabel = computed<string>(() => {
    const s = this.selected();
    if (!s) return '';
    const parts = [s.grado, s.seccion].filter(Boolean) as string[];
    return parts.join(' ');
  });

  /** Iniciales para el avatar del alumno seleccionado. */
  readonly studentInitials = computed<string>(() => {
    const s = this.selected();
    if (!s) return '';
    return `${(s.nombre[0] ?? '').toUpperCase()}${(s.apellido_paterno[0] ?? '').toUpperCase()}`;
  });

  readonly pickedLabel = computed<string | null>(() => {
    const p = this.picked();
    if (!p) return null;
    return `${diaLabel(p.dia)} ${p.dateLabel} · ${p.hour}`;
  });

  readonly hasAvailabilityConfigured = computed(() =>
    this.availability().some(a => a.activo),
  );

  /**
   * Regla del rol del propio docente/admin (define duración + días).
   * Fallback a la regla de docente si no se puede resolver la sesión,
   * ya que este dialog sólo se abre desde la vista del docente.
   */
  readonly myRule = computed(() => {
    const me = this.auth.currentUser();
    if (!me) return APPOINTMENT_RULES.docente;
    return ruleForRol(me.rol, me.cargo) ?? APPOINTMENT_RULES.docente;
  });
  readonly mySlotMinutes = computed<number>(() => {
    const dur = this.form?.value?.durationMin;
    const fallback = typeof dur === 'number' && dur > 0 ? dur : 45;
    return ruleToSlotMinutes(this.myRule(), fallback);
  });
  readonly myAllowedDays = computed<readonly string[]>(
    () => this.myRule().allowedDays,
  );
  readonly myStartHour = computed<number>(
    () => ruleToStartHour(this.myRule()),
  );
  readonly myEndHour = computed<number>(
    () => ruleToEndHour(this.myRule()),
  );

  // ── Form ────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    studentQuery: ['', [Validators.required]],
    tipo: ['academico', [Validators.required]],
    date: [null as Date | null, [Validators.required]],
    time: ['', [Validators.required]],
    durationMin: [30, [Validators.required, Validators.min(15), Validators.max(180)]],
    motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    priorNotes: [''],
  });

  // ── Lifecycle ───────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    // Buscar alumnos a medida que el docente tipea.
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

    // Cargar mi propia disponibilidad y mis slots ocupados.
    await Promise.all([this.refreshAvailability(), this.refreshSlotsTaken()]);
  }

  // ── Helpers ─────────────────────────────────────────────────
  displayStudent = (s: StudentOption | string): string => {
    if (!s) return '';
    if (typeof s === 'string') return s;
    const fullName =
      `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
    const gradoSec = [s.grado, s.seccion].filter(Boolean).join(' ');
    return gradoSec ? `${fullName} · ${gradoSec}` : fullName;
  };

  studentInitialsOf(s: StudentOption): string {
    return `${(s.nombre[0] ?? '').toUpperCase()}${(s.apellido_paterno[0] ?? '').toUpperCase()}`;
  }

  onSelectStudent(s: StudentOption): void {
    this.selected.set(s);
    this.form.patchValue({ studentQuery: s }, { emitEvent: false });
  }

  clearStudent(): void {
    this.selected.set(null);
    this.form.patchValue({ studentQuery: '' });
    this.students.set([]);
  }

  // ── Booking calendar ────────────────────────────────────────
  async onWeekChange(weekStart: string): Promise<void> {
    this.weekStart.set(weekStart);
    this.clearPicked();
    await this.refreshSlotsTaken();
  }

  async onDurationChange(): Promise<void> {
    // Si cambia la duración, lo agendado deja de tener sentido.
    this.clearPicked();
    await this.refreshSlotsTaken();
  }

  async onSlotPick(ev: BookingPickEvent): Promise<void> {
    const dur = ev.durationMin ?? this.form.value.durationMin ?? 45;
    const endTime = ev.endHour;

    const longDate =
      `${diaLabel(ev.dia)} ${pad2(ev.date.getDate())}/${pad2(ev.date.getMonth() + 1)}/${ev.date.getFullYear()}`;

    const data: ConfirmData = {
      title: 'Confirmar horario',
      message:
        `Fecha: ${longDate}\n` +
        `Horario: ${ev.hour} – ${endTime} (${dur} min)\n\n` +
        `El padre/tutor recibirá la convocatoria en estado pendiente.`,
      confirm: 'Usar este horario',
      cancel: 'Cambiar',
    };

    const ok = await firstValueFrom(
      this.dialog.open(ConfirmDialog, { data, width: '380px' }).afterClosed(),
    );
    if (!ok) return;

    this.picked.set({
      dia: ev.dia,
      hour: ev.hour,
      dateLabel: `${pad2(ev.date.getDate())}/${pad2(ev.date.getMonth() + 1)}`,
    });
    this.form.patchValue({
      date: startOfDay(ev.date),
      time: ev.hour,
      durationMin: dur,
    });
  }

  clearPicked(): void {
    this.picked.set(null);
    this.form.patchValue({ date: null, time: '' });
  }

  // ── Carga remota ────────────────────────────────────────────
  private async refreshAvailability(): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) { this.availability.set([]); return; }
    this.loadingAvailability.set(true);
    try {
      this.availability.set(await this.store.getAvailability(me.id));
    } catch {
      this.availability.set([]);
    } finally {
      this.loadingAvailability.set(false);
    }
  }

  private async refreshSlotsTaken(): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) { this.slotsTaken.set([]); return; }
    this.loadingSlots.set(true);
    try {
      this.slotsTaken.set(await this.store.getSlotsTaken(me.id, this.weekStart()));
    } catch {
      this.slotsTaken.set([]);
    } finally {
      this.loadingSlots.set(false);
    }
  }

  // ── Submit ──────────────────────────────────────────────────
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
      // 409 → otro pidió el mismo slot entre el load y el submit. Reset
      // selección + refrescar slotsTaken para que el usuario vea el
      // bloque marcado como ocupado.
      if (isConflictError(err)) {
        this.errorMsg.set('Ese horario ya está ocupado. Elige otro slot disponible.');
        this.picked.set(null);
        this.refreshSlotsTaken();
      } else {
        this.errorMsg.set(parseApiError(err, 'No se pudo crear la cita'));
      }
    } finally {
      this.loading.set(false);
    }
  }
}

function isConflictError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { status?: unknown }).status;
  return status === 409;
}
