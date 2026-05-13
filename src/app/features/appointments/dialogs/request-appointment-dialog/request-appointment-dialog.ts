import {
    ChangeDetectionStrategy, Component, OnInit,
    computed, inject, signal,
} from '@angular/core';
import {
    FormBuilder, FormGroup, ReactiveFormsModule, Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ToastService } from 'ngx-toastr-notifier';
import { ConfirmDialog, ConfirmData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { diaLabel as diaLabelFn, pad2 as pad2Fn } from '../../../../shared/utils/calendar-week';
import {
    BookingCalendar, BookingPickEvent,
} from '../../../../shared/components/booking-calendar/booking-calendar';
import {
    combineDateAndTime, diaLabel, getCurrentMonday, startOfDay,
} from '../../../../shared/utils/calendar-week';
import { parseApiError } from '../../../../shared/utils/api-errors';

import { AppointmentsStore } from '../../data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import {
    AccountAvailability, Appointment, AppointmentTipo, DiaSemana, SlotTaken,
    AppointmentRoleRule, APPOINTMENT_RULES,
    ruleToStartHour, ruleToEndHour, ruleToSlotMinutes,
} from '../../../../core/models/appointments';
import { Psicologa, Docente } from '../../../../core/models/psychology';
import { Child } from '../../../../core/models/parent-portal';

export type ProfessionalKind = 'psicologa' | 'docente';

export interface RequestAppointmentDialogData {
    mode: 'alumno' | 'padre';
    preselectedChildId?: string;
    /**
     * Cita que se está reagendando. Si está presente:
     *   - El dialog cambia textos a "Reagendar".
     *   - Pre-llena profesional, tipo, duración, motivo y notas.
     *   - El submit llama a `updateAppointment(id, { scheduledAt, durationMin })`
     *     en vez de crear una cita nueva (el slot anterior queda libre porque
     *     la misma cita pasa a otra hora).
     */
    rescheduleFor?: Appointment;
}

const MIN_LEAD_MINUTES = 15;

interface PickedSlot {
    dia: DiaSemana;
    hour: string;
    dateLabel: string;
}

@Component({
    selector: 'app-request-appointment-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule,
        MatSelectModule, MatButtonModule, MatButtonToggleModule,
        MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
        MatDatepickerModule, BookingCalendar,
    ],
    templateUrl: './request-appointment-dialog.html',
    styleUrl: './request-appointment-dialog.scss',
})
export class RequestAppointmentDialog implements OnInit {
    // ── Inyecciones ────────────────────────────────────────────
    readonly data: RequestAppointmentDialogData =
        inject<RequestAppointmentDialogData | null>(MAT_DIALOG_DATA, { optional: true })
        ?? { mode: 'alumno' };
    private ref = inject(MatDialogRef<RequestAppointmentDialog>);
    private fb = inject(FormBuilder);
    private dialog = inject(MatDialog);
    private auth = inject(AuthService);
    private toastr = inject(ToastService);
    readonly store = inject(AppointmentsStore);

    // ── Catálogos ───────────────────────────────────────────────
    readonly tipos: { value: AppointmentTipo; label: string }[] = [
        { value: 'academico', label: 'Académico' },
        { value: 'conductual', label: 'Conductual' },
        { value: 'psicologico', label: 'Psicológico' },
        { value: 'familiar', label: 'Familiar' },
        { value: 'disciplinario', label: 'Disciplinario' },
        { value: 'otro', label: 'Otro' },
    ];

    readonly minDate = startOfDay(new Date());

    // ── Estado UI ──────────────────────────────────────────────
    loading = signal(false);
    errorMsg = signal('');
    loadingAvailability = signal(false);
    loadingSlots = signal(false);

    private readonly rescheduleSrc = signal<Appointment | null>(this.data.rescheduleFor ?? null);
    /** True si el dialog está reagendando una cita existente. */
    readonly isReschedule = computed<boolean>(() => !!this.rescheduleSrc());

    /** Solo aplica al modo `padre`. Alumno siempre va con psicóloga. */
    professionalKind = signal<ProfessionalKind>('psicologa');

    // ── Calendario booking ─────────────────────────────────────
    weekStart = signal<string>(getCurrentMonday());
    availability = signal<AccountAvailability[]>([]);
    slotsTaken = signal<SlotTaken[]>([]);
    picked = signal<PickedSlot | null>(null);
    activeRule = signal<AppointmentRoleRule | null>(null);

    readonly pickedLabel = computed<string | null>(() => {
        const p = this.picked();
        if (!p) return null;
        return `${diaLabel(p.dia)} ${p.dateLabel} a las ${p.hour}`;
    });

    readonly selectedChild = computed<Child | null>(() => {
        const id = this.form?.value?.childId;
        if (!id) return null;
        return this.store.children().find(c => c.id === id) ?? null;
    });

    readonly selectedProfessionalLabel = computed<string>(() => {
        const id = this.form?.value?.professionalId;
        if (!id) return '';
        if (this.professionalKind() === 'docente') {
            const d = this.store.docentes().find(x => x.id === id);
            return d ? this.docenteLabel(d) : '';
        }
        const p = this.store.psicologas().find(x => x.id === id);
        return p ? this.psicologaLabel(p) : '';
    });

    // ── Regla efectiva ─────────────────────────────────────────
    /**
     * Regla usada para configurar el calendario. Prefiere la regla del
     * backend (resuelve admin→director vía cargo) y cae a la regla local
     * por `professionalKind` mientras se carga / si el BE no responde.
     * De este modo el calendario nunca se renderiza con cotas por defecto
     * incorrectas (08–20). Asume que el alumno sólo puede convocar a la
     * psicóloga y el padre elige psicóloga o docente.
     */
    readonly effectiveRule = computed<AppointmentRoleRule>(() => {
        const remote = this.activeRule();
        if (remote) return remote;
        return this.professionalKind() === 'docente'
            ? APPOINTMENT_RULES.docente
            : APPOINTMENT_RULES.psicologa;
    });

    /** Tamaño de slot en minutos para la grilla y `buildBookingSlots`. */
    readonly ruleSlotMinutes = computed<number>(() => {
        const r = this.effectiveRule();
        const dur = this.form?.value?.durationMin;
        const fallback = typeof dur === 'number' && dur > 0 ? dur : 30;
        return ruleToSlotMinutes(r, fallback);
    });
    /** Días permitidos para esta regla (mar/jue para director, L-V para el resto). */
    readonly ruleAllowedDays = computed<readonly string[] | null>(
        () => this.effectiveRule().allowedDays,
    );
    readonly ruleStartHour = computed<number>(
        () => ruleToStartHour(this.effectiveRule()),
    );
    readonly ruleEndHour = computed<number>(
        () => ruleToEndHour(this.effectiveRule()),
    );

    // ── Form ───────────────────────────────────────────────────
    form: FormGroup = this.fb.group({
        childId: [this.data.preselectedChildId ?? ''],
        professionalId: ['', [Validators.required]],
        tipo: ['psicologico', [Validators.required]],
        durationMin: [30, [Validators.required, Validators.min(15), Validators.max(180)]],
        date: [null as Date | null, [Validators.required]],
        time: ['', [Validators.required]],
        motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
        priorNotes: [''],
    });

    // ── Lifecycle ──────────────────────────────────────────────
    async ngOnInit(): Promise<void> {
        if (this.data.mode === 'padre') {
            this.form.get('childId')?.addValidators(Validators.required);
            this.form.get('childId')?.updateValueAndValidity();
            if (this.store.children().length === 0) await this.store.loadChildren();
            if (!this.form.value.childId && this.store.children().length === 1) {
                this.form.patchValue({ childId: this.store.children()[0].id });
            }
        }

        const rs = this.rescheduleSrc();
        if (rs) {
            // En modo "reagendar" usamos el profesional/tipo/duración/motivo
            // de la cita original y dejamos al usuario elegir un nuevo slot.
            const isDoc = rs.convocadoA?.rol === 'docente';
            this.professionalKind.set(isDoc ? 'docente' : 'psicologa');
            this.form.patchValue({
                professionalId: rs.convocadoAId,
                tipo: rs.tipo,
                durationMin: rs.durationMin,
                motivo: rs.motivo,
                priorNotes: rs.priorNotes ?? '',
                childId: rs.studentId ?? this.data.preselectedChildId ?? '',
            });
            await this.loadProfessionalsForKind();
            await this.refreshProfessionalCalendar();
        } else {
            await this.loadProfessionalsForKind();
        }
    }

    // ── Catálogos: psicólogas / docentes ───────────────────────
    private async loadProfessionalsForKind(): Promise<void> {
        if (this.professionalKind() === 'docente') {
            if (this.store.docentes().length === 0) await this.store.loadDocentes();
            if (this.store.docentes().length === 1 && !this.form.value.professionalId) {
                this.form.patchValue({ professionalId: this.store.docentes()[0].id });
                await this.refreshProfessionalCalendar();
            }
        } else {
            if (this.store.psicologas().length === 0) await this.store.loadPsicologas();
            if (this.store.psicologas().length === 1 && !this.form.value.professionalId) {
                this.form.patchValue({ professionalId: this.store.psicologas()[0].id });
                await this.refreshProfessionalCalendar();
            }
        }
    }

    async onKindChange(kind: ProfessionalKind): Promise<void> {
        if (this.isReschedule()) return; // no permitimos cambiar el tipo al reagendar
        this.professionalKind.set(kind);
        this.form.patchValue({ professionalId: '' });
        this.availability.set([]);
        this.slotsTaken.set([]);
        this.clearPicked();
        await this.loadProfessionalsForKind();
    }

    // ── Helpers visuales ────────────────────────────────────────
    childLabel(c: Child): string {
        return `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno ?? ''}`.trim();
    }

    psicologaLabel(p: Psicologa): string {
        const esp = p.especialidad ? ` · ${p.especialidad}` : '';
        return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + esp;
    }

    docenteLabel(d: Docente): string {
        const esp = d.especialidad ? ` · ${d.especialidad}` : '';
        const tut = d.tutoria_actual ? ` · Tutor ${d.tutoria_actual.seccion_label}` : '';
        return `${d.nombre} ${d.apellido_paterno} ${d.apellido_materno ?? ''}`.trim() + esp + tut;
    }

    // ── Cambios de control ─────────────────────────────────────
    async onProfessionalChange(): Promise<void> {
        this.clearPicked();
        await this.refreshProfessionalCalendar();
    }

    async onWeekChange(weekStart: string): Promise<void> {
        this.weekStart.set(weekStart);
        this.clearPicked();
        await this.refreshSlotsTaken();
    }

    async onDurationChange(): Promise<void> {
        this.clearPicked();
        await this.refreshSlotsTaken();
    }

    /** Click en un slot disponible → abre confirmación → si confirma, llena el form. */
    async onSlotPick(ev: BookingPickEvent): Promise<void> {
        const dur = ev.durationMin ?? this.form.value.durationMin ?? 30;
        const endTime = ev.endHour;

        const longDate =
            `${diaLabelFn(ev.dia)} ${pad2Fn(ev.date.getDate())}/${pad2Fn(ev.date.getMonth() + 1)}/${ev.date.getFullYear()}`;

        const data: ConfirmData = {
            title: this.isReschedule() ? 'Confirmar nuevo horario' : 'Confirmar horario',
            message:
                `Profesional: ${this.selectedProfessionalLabel() || 'Profesional'}\n` +
                `Fecha: ${longDate}\n` +
                `Horario: ${ev.hour} – ${endTime} (${dur} min)\n\n` +
                (this.isReschedule()
                    ? 'El horario anterior quedará libre automáticamente.'
                    : 'Después podrás seguir editando los demás campos.'),
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
            dateLabel: `${pad2Fn(ev.date.getDate())}/${pad2Fn(ev.date.getMonth() + 1)}`,
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
    private async refreshProfessionalCalendar(): Promise<void> {
        const id = this.form.value.professionalId;
        if (!id) {
            this.availability.set([]);
            this.slotsTaken.set([]);
            this.activeRule.set(null);
            return;
        }
        await Promise.all([
            this.refreshAvailability(id),
            this.refreshRules(id),
            this.refreshSlotsTaken(),
        ]);
        this.applyRulesToCalendar(id);
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

    private applyRulesToCalendar(profId: string): void {
        const rule = this.activeRule();
        if (!rule) return;
        if (rule.fixedDurationMin != null) {
            this.form.patchValue({ durationMin: rule.fixedDurationMin });
        }
        if (this.availability().length === 0) {
            const now = new Date().toISOString();
            const synth: AccountAvailability[] = rule.allowedDays.map((d, i) => ({
                id: `virtual-${profId}-${d}-${i}`,
                cuentaId: profId,
                diaSemana: d as AccountAvailability['diaSemana'],
                horaInicio: rule.defaultHours.start,
                horaFin: rule.defaultHours.end,
                activo: true,
                createdAt: now,
                updatedAt: now,
            }));
            this.availability.set(synth);
        }
    }

    private async refreshSlotsTaken(): Promise<void> {
        const id = this.form.value.professionalId;
        if (!id) { this.slotsTaken.set([]); return; }
        this.loadingSlots.set(true);
        try {
            this.slotsTaken.set(await this.store.getSlotsTaken(id, this.weekStart()));
        } catch {
            this.slotsTaken.set([]);
        } finally {
            this.loadingSlots.set(false);
        }
    }

    // ── Submit ──────────────────────────────────────────────────
    cancel(): void { this.ref.close(false); }

    async submit(): Promise<void> {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        const me = this.auth.currentUser();
        if (!me) { this.errorMsg.set('Sesión inválida, vuelve a iniciar sesión.'); return; }

        const v = this.form.value;
        const scheduled = combineDateAndTime(v.date as Date, v.time as string);
        const minStart = Date.now() + MIN_LEAD_MINUTES * 60_000;
        if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < minStart) {
            this.errorMsg.set(
                `La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`,
            );
            return;
        }
        if (v.professionalId === me.id) {
            this.errorMsg.set('No puedes convocarte a ti mismo.');
            return;
        }

        const rs = this.rescheduleSrc();
        this.loading.set(true);
        this.errorMsg.set('');
        try {
            if (rs) {
                // Reagendar — cambiamos hora/duración; el slot anterior queda
                // libre porque la cita misma cambia de scheduledAt y el BE
                // sólo cuenta como "ocupado" pendiente/confirmada.
                await this.store.updateAppointment(rs.id, {
                    scheduledAt: scheduled.toISOString(),
                    durationMin: v.durationMin,
                });
                this.toastr.success('Cita reagendada');
            } else {
                let studentId = '';
                let parentId: string | undefined;
                if (this.data.mode === 'alumno') {
                    studentId = me.id;
                } else {
                    studentId = v.childId;
                    parentId = me.id;
                }
                await this.store.createAppointment({
                    convocadoAId: v.professionalId,
                    studentId,
                    parentId,
                    tipo: v.tipo,
                    motivo: v.motivo,
                    scheduledAt: scheduled.toISOString(),
                    durationMin: v.durationMin,
                    priorNotes: v.priorNotes || undefined,
                });
                this.toastr.success('Cita solicitada');
            }
            this.ref.close(true);
        } catch (err: unknown) {
            // Si el backend nos devuelve 409 (slot tomado por otro entre el
            // load inicial y el submit), refrescamos slotsTaken para que el
            // usuario vea el bloque ocupado en gris y elija otro.
            if (isConflictError(err)) {
                this.errorMsg.set('Ese horario ya está ocupado. Elige otro slot disponible.');
                this.clearPicked();
                this.refreshSlotsTaken();
            } else {
                this.errorMsg.set(
                    parseApiError(err, rs ? 'No se pudo reagendar la cita' : 'No se pudo solicitar la cita'),
                );
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
