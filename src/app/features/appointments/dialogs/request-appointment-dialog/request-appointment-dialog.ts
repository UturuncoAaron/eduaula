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
    AccountAvailability, AppointmentTipo, DiaSemana, SlotTaken,
} from '../../../../core/models/appointments';
import { Psicologa, Docente } from '../../../../core/models/psychology';
import { Child } from '../../../../core/models/parent-portal';

export type ProfessionalKind = 'psicologa' | 'docente';

export interface RequestAppointmentDialogData {
    mode: 'alumno' | 'padre';
    preselectedChildId?: string;
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
    readonly data: RequestAppointmentDialogData = inject(MAT_DIALOG_DATA);
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

    /** Solo aplica al modo `padre`. Alumno siempre va con psicóloga. */
    professionalKind = signal<ProfessionalKind>('psicologa');

    // ── Calendario booking ─────────────────────────────────────
    weekStart = signal<string>(getCurrentMonday());
    availability = signal<AccountAvailability[]>([]);
    slotsTaken = signal<SlotTaken[]>([]);
    picked = signal<PickedSlot | null>(null);

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
        await this.loadProfessionalsForKind();
    }

    // ── Catálogos: psicólogas / docentes ───────────────────────
    private async loadProfessionalsForKind(): Promise<void> {
        if (this.professionalKind() === 'docente') {
            if (this.store.docentes().length === 0) await this.store.loadDocentes();
            if (this.store.docentes().length === 1) {
                this.form.patchValue({ professionalId: this.store.docentes()[0].id });
                await this.refreshProfessionalCalendar();
            }
        } else {
            if (this.store.psicologas().length === 0) await this.store.loadPsicologas();
            if (this.store.psicologas().length === 1) {
                this.form.patchValue({ professionalId: this.store.psicologas()[0].id });
                await this.refreshProfessionalCalendar();
            }
        }
    }

    async onKindChange(kind: ProfessionalKind): Promise<void> {
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
        const dur = this.form.value.durationMin ?? 30;
        const [h, m] = ev.hour.split(':').map(Number);
        const totalEnd = (h ?? 0) * 60 + (m ?? 0) + dur;
        const endTime = `${pad2Fn(Math.floor(totalEnd / 60) % 24)}:${pad2Fn(totalEnd % 60)}`;

        const longDate =
            `${diaLabelFn(ev.dia)} ${pad2Fn(ev.date.getDate())}/${pad2Fn(ev.date.getMonth() + 1)}/${ev.date.getFullYear()}`;

        const data: ConfirmData = {
            title: 'Confirmar horario',
            message:
                `Profesional: ${this.selectedProfessionalLabel() || 'Profesional'}\n` +
                `Fecha: ${longDate}\n` +
                `Horario: ${ev.hour} – ${endTime} (${dur} min)\n\n` +
                `Después podrás seguir editando los demás campos.`,
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
        this.form.patchValue({ date: startOfDay(ev.date), time: ev.hour });
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
            return;
        }
        await Promise.all([this.refreshAvailability(id), this.refreshSlotsTaken()]);
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

        let studentId = '';
        let parentId: string | undefined;
        if (this.data.mode === 'alumno') {
            studentId = me.id;
        } else {
            studentId = v.childId;
            parentId = me.id;
        }

        this.loading.set(true);
        this.errorMsg.set('');
        try {
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
            this.ref.close(true);
        } catch (err: unknown) {
            this.errorMsg.set(parseApiError(err, 'No se pudo solicitar la cita'));
        } finally {
            this.loading.set(false);
        }
    }
}