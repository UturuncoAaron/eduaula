import {
    ChangeDetectionStrategy, Component, OnInit,
    computed, inject, signal,
} from '@angular/core';
import {
    FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
    MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
    BookingCalendar, BookingPickEvent,
} from '../../../../shared/components/booking-calendar/booking-calendar';
import {
    ConfirmDialog, ConfirmData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog';
import {
    combineDateAndTime, diaLabel, getCurrentMonday, pad2, startOfDay,
} from '../../../../shared/utils/calendar-week';
import { parseApiError } from '../../../../shared/utils/api-errors';

import { AppointmentsStore } from '../../data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import {
    AccountAvailability, Appointment, DiaSemana, SlotTaken,
    AppointmentRoleRule, APPOINTMENT_RULES,
    ruleToStartHour, ruleToEndHour, ruleToSlotMinutes,
} from '../../../../core/models/appointments';

export interface PostponeDialogData {
    appointment: Appointment;
}

export interface PostponeDialogResult {
    success: true;
}

interface PickedSlot {
    dia: DiaSemana;
    hour: string;
    dateLabel: string;
}

const MIN_LEAD_MINUTES = 15;

/**
 * Roles cuyo calendario manda en una cita (dueños de disponibilidad).
 * Si el convocador tiene un rol en este set, la cita "vive" en su
 * calendario; si no, vive en el del convocado.
 */
const CALENDAR_OWNER_ROLES = new Set<string>([
    'psicologa',
    'docente',
    'admin',
    'director',
]);

/**
 * Dialog para aplazar (re-proponer) una cita.
 *
 * El nuevo horario SIEMPRE se selecciona dentro de la disponibilidad del
 * dueño del calendario (psicóloga / docente / admin / director), nunca
 * del convocado pasivo (padre / alumno).
 *
 *   - Si el convocador es quien tiene calendario (caso típico): la cita
 *     ya estaba en su calendario; el nuevo slot también debe estarlo.
 *   - Si el convocador es padre/alumno: el dueño del calendario es el
 *     convocado (psicóloga / docente).
 *
 * Motivo obligatorio. El BE devuelve la cita a `pendiente` con la nueva
 * `scheduledAt` y registra el motivo en `priorNotes` + en
 * `cita_estado_log.razon`.
 */
@Component({
    selector: 'app-postpone-appointment-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule,
        MatButtonModule, MatIconModule, MatProgressSpinnerModule,
        BookingCalendar,
    ],
    templateUrl: './postpone-appointment-dialog.html',
    styleUrl: './postpone-appointment-dialog.scss',
})
export class PostponeAppointmentDialog implements OnInit {
    readonly data: PostponeDialogData = inject(MAT_DIALOG_DATA);
    private ref = inject(MatDialogRef<PostponeAppointmentDialog, PostponeDialogResult>);
    private fb = inject(FormBuilder);
    private dialog = inject(MatDialog);
    private store = inject(AppointmentsStore);
    private auth = inject(AuthService);

    /**
     * `true` cuando el usuario logueado es el convocador (creó la cita).
     * Cambia copy y subtítulo del modal: el convocador re-propone su
     * propio horario; el convocado contra-propone dentro del calendario
     * del convocador.
     */
    readonly esConvocador = computed<boolean>(
        () => this.data.appointment.createdById === this.auth.currentUser()?.id,
    );

    readonly headerTitle = computed<string>(
        () => this.esConvocador() ? 'Reprogramar mi cita' : 'Aplazar cita',
    );

    readonly headerSubtitle = computed<string>(() => {
        if (this.esConvocador()) {
            return 'Propón un nuevo horario dentro de tu disponibilidad. ' +
                'La cita volverá a quedar pendiente hasta que el convocado la confirme.';
        }
        return 'Propón una nueva fecha dentro de la disponibilidad del profesional. ' +
            'La cita volverá a quedar pendiente hasta que el convocador la confirme.';
    });

    // ── State ──────────────────────────────────────────────────
    loading = signal(false);
    errorMsg = signal('');
    loadingAvailability = signal(false);
    loadingSlots = signal(false);

    weekStart = signal<string>(getCurrentMonday());
    availability = signal<AccountAvailability[]>([]);
    slotsTaken = signal<SlotTaken[]>([]);
    picked = signal<PickedSlot | null>(null);
    activeRule = signal<AppointmentRoleRule | null>(null);

    readonly scheduleOwnerId = computed<string | null>(() => {
        const appt = this.data.appointment;
        const rolConvocador = appt.convocadoPor?.rol ?? '';
        const rolConvocado = appt.convocadoA?.rol ?? '';

        // Si el que inició la cita es el profesional, devolvemos su ID
        if (CALENDAR_OWNER_ROLES.has(rolConvocador)) {
            // ¡Ojo aquí! Usamos el ID de la relación, no createdById, por seguridad.
            return appt.convocadoPor?.id ?? appt.createdById;
        }

        // Si el convocado es el profesional (ej. Padre citó a Psicóloga), devolvemos su ID
        if (CALENDAR_OWNER_ROLES.has(rolConvocado)) {
            return appt.convocadoAId;
        }

        // Fallback en caso de datos anómalos
        return null;
    });

    /**
     * Calcula la regla de duración y horas basada en el rol del dueño del calendario.
     */
    readonly effectiveRule = computed<AppointmentRoleRule>(() => {
        const remote = this.activeRule();
        if (remote) return remote;

        const appt = this.data.appointment;
        const rolConvocador = appt.convocadoPor?.rol ?? '';
        const rolConvocado = appt.convocadoA?.rol ?? '';

        const ownerRol = CALENDAR_OWNER_ROLES.has(rolConvocador)
            ? rolConvocador
            : rolConvocado;

        if (ownerRol === 'docente') return APPOINTMENT_RULES.docente;
        if (ownerRol === 'admin' || ownerRol === 'director') return APPOINTMENT_RULES.admin;
        return APPOINTMENT_RULES.psicologa;
    });
    readonly ruleSlotMinutes = computed<number>(() => {
        const r = this.effectiveRule();
        return ruleToSlotMinutes(r, this.data.appointment.durationMin ?? 30);
    });
    readonly ruleAllowedDays = computed<readonly string[] | null>(
        () => this.effectiveRule().allowedDays,
    );
    readonly ruleStartHour = computed<number>(() => ruleToStartHour(this.effectiveRule()));
    readonly ruleEndHour = computed<number>(() => ruleToEndHour(this.effectiveRule()));

    readonly pickedLabel = computed<string | null>(() => {
        const p = this.picked();
        if (!p) return null;
        return `${diaLabel(p.dia)} ${p.dateLabel} · ${p.hour}`;
    });

    // ── Form ───────────────────────────────────────────────────
    form: FormGroup = this.fb.group({
        motivo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
        date: [null as Date | null, [Validators.required]],
        time: ['', [Validators.required]],
    });

    // ── Lifecycle ──────────────────────────────────────────────
    async ngOnInit(): Promise<void> {
        const ownerId = this.scheduleOwnerId();
        if (!ownerId) {
            this.errorMsg.set(
                'La cita no tiene un calendario asociado, no se puede aplazar.',
            );
            return;
        }
        await Promise.all([
            this.refreshAvailability(ownerId),
            this.refreshRules(ownerId),
            this.refreshSlotsTaken(),
        ]);
        this.applyRulesToCalendar(ownerId);
    }

    private async refreshAvailability(profId: string): Promise<void> {
        this.loadingAvailability.set(true);
        try {
            this.availability.set(await this.store.getAvailability(profId));
        } catch {
            this.availability.set([]);
        } finally {
            this.loadingAvailability.set(false);
        }
    }

    private async refreshRules(profId: string): Promise<void> {
        try {
            const rule = await this.store.getRulesForTarget(profId);
            this.activeRule.set(rule);
        } catch {
            this.activeRule.set(null);
        }
    }

    private async refreshSlotsTaken(): Promise<void> {
        const ownerId = this.scheduleOwnerId();
        if (!ownerId) { this.slotsTaken.set([]); return; }
        this.loadingSlots.set(true);
        try {
            this.slotsTaken.set(await this.store.getSlotsTaken(ownerId, this.weekStart()));
        } catch {
            this.slotsTaken.set([]);
        } finally {
            this.loadingSlots.set(false);
        }
    }

    private applyRulesToCalendar(profId: string): void {
        const rule = this.activeRule();
        if (!rule) return;
        if (this.availability().length === 0) {
            const now = new Date().toISOString();
            const synth: AccountAvailability[] = rule.allowedDays.map((d, i) => ({
                id: `virtual-${profId}-${d}-${i}`,
                cuentaId: profId,
                diaSemana: d as DiaSemana,
                horaInicio: rule.defaultHours.start,
                horaFin: rule.defaultHours.end,
                activo: true,
                tipo: 'weekly' as const,
                fechaEspecifica: null,
                createdAt: now,
                updatedAt: now,
            }));
            this.availability.set(synth);
        }
    }

    // ── Pick ────────────────────────────────────────────────────
    async onWeekChange(weekStart: string): Promise<void> {
        this.weekStart.set(weekStart);
        this.clearPicked();
        await this.refreshSlotsTaken();
    }

    async onSlotPick(ev: BookingPickEvent): Promise<void> {
        const dur = ev.durationMin ?? this.data.appointment.durationMin ?? 30;
        const longDate =
            `${diaLabel(ev.dia)} ${pad2(ev.date.getDate())}/${pad2(ev.date.getMonth() + 1)}/${ev.date.getFullYear()}`;

        const ok = await firstValueFrom(
            this.dialog.open(ConfirmDialog, {
                width: '380px',
                data: {
                    title: 'Confirmar nuevo horario',
                    message:
                        `Fecha: ${longDate}\n` +
                        `Horario: ${ev.hour} – ${ev.endHour} (${dur} min)\n\n` +
                        'La cita volverá a quedar pendiente con esta nueva fecha.',
                    confirm: 'Usar este horario',
                    cancel: 'Cambiar',
                } as ConfirmData,
            }).afterClosed(),
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
        });
    }

    clearPicked(): void {
        this.picked.set(null);
        this.form.patchValue({ date: null, time: '' });
    }

    // ── Submit ──────────────────────────────────────────────────
    cancel(): void { this.ref.close(); }

    async submit(): Promise<void> {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        const v = this.form.value;

        const scheduled = combineDateAndTime(v.date as Date, v.time as string);
        const minStart = Date.now() + MIN_LEAD_MINUTES * 60_000;
        if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < minStart) {
            this.errorMsg.set(
                `La nueva fecha debe ser al menos ${MIN_LEAD_MINUTES} minutos a futuro.`,
            );
            return;
        }

        this.loading.set(true);
        this.errorMsg.set('');
        try {
            await this.store.postponeAppointment(this.data.appointment.id, {
                motivo: (v.motivo as string).trim(),
                nuevaFechaHora: scheduled.toISOString(),
            });
            this.ref.close({ success: true });
        } catch (err: unknown) {
            this.errorMsg.set(parseApiError(err, 'No se pudo aplazar la cita'));
        } finally {
            this.loading.set(false);
        }
    }
}
