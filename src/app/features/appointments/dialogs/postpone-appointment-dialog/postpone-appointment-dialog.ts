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
 * Dialog para aplazar (re-proponer) una cita. Padre o alumno escogen
 * nueva fecha y hora **dentro de la disponibilidad del convocado** y
 * dejan un motivo obligatorio. El BE devuelve la cita a `pendiente`
 * con la nueva `scheduledAt` y registra el motivo en `priorNotes`.
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

    // ── Reglas calc ────────────────────────────────────────────
    readonly effectiveRule = computed<AppointmentRoleRule>(() => {
        const remote = this.activeRule();
        if (remote) return remote;
        // Fallback razonable: si el convocado tiene rol de docente, usar
        // regla docente (45 min). Caso contrario psicóloga (30 min).
        const rol = this.data.appointment.convocadoA?.rol ?? '';
        if (rol === 'docente') return APPOINTMENT_RULES.docente;
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
        const profId = this.data.appointment.convocadoAId;
        if (!profId) {
            this.errorMsg.set('La cita no tiene un convocado asignado, no se puede aplazar.');
            return;
        }
        await Promise.all([
            this.refreshAvailability(profId),
            this.refreshRules(profId),
            this.refreshSlotsTaken(),
        ]);
        this.applyRulesToCalendar(profId);
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
        const profId = this.data.appointment.convocadoAId;
        if (!profId) { this.slotsTaken.set([]); return; }
        this.loadingSlots.set(true);
        try {
            this.slotsTaken.set(await this.store.getSlotsTaken(profId, this.weekStart()));
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
