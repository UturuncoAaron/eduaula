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

import { AppointmentsStore, StudentSearchResult } from '../../data-access/appointments.store';
import {
    AccountAvailability, DiaSemana, SlotTaken,
    APPOINTMENT_RULES,
    ruleToStartHour, ruleToEndHour, ruleToSlotMinutes,
} from '../../../../core/models/appointments';
import { Psicologa } from '../../../../core/models/psychology';

type StudentOption = StudentSearchResult;

interface PickedSlot {
    dia: DiaSemana;
    hour: string;
    dateLabel: string;
}

const MIN_LEAD_MINUTES = 15;

/**
 * Dialog para derivar un alumno docente → psicóloga. Crea la cita con
 * `tipo='psicologico'` y emite `cita_agendada` a la psicóloga elegida.
 * También garantiza el vínculo `psicologa_alumno` (lo hace el BE).
 */
@Component({
    selector: 'app-derive-to-psicologa-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule,
        MatSelectModule, MatAutocompleteModule, MatButtonModule,
        MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
        BookingCalendar,
    ],
    templateUrl: './derive-to-psicologa-dialog.html',
    styleUrl: './derive-to-psicologa-dialog.scss',
})
export class DeriveToPsicologaDialog implements OnInit {
    private ref = inject(MatDialogRef<DeriveToPsicologaDialog, boolean>);
    private fb = inject(FormBuilder);
    private dialog = inject(MatDialog);
    readonly store = inject(AppointmentsStore);

    // ── UI state ────────────────────────────────────────────────
    loading = signal(false);
    errorMsg = signal('');

    searching = signal(false);
    students = signal<StudentOption[]>([]);
    selectedStudent = signal<StudentOption | null>(null);

    loadingAvailability = signal(false);
    loadingSlots = signal(false);
    weekStart = signal<string>(getCurrentMonday());
    availability = signal<AccountAvailability[]>([]);
    slotsTaken = signal<SlotTaken[]>([]);
    picked = signal<PickedSlot | null>(null);

    // Regla de la psicóloga (30 min, L-V)
    readonly psicologaRule = APPOINTMENT_RULES.psicologa;
    readonly slotMinutes = ruleToSlotMinutes(this.psicologaRule, 30);
    readonly allowedDays = this.psicologaRule.allowedDays;
    readonly startHour = ruleToStartHour(this.psicologaRule);
    readonly endHour = ruleToEndHour(this.psicologaRule);

    readonly pickedLabel = computed<string | null>(() => {
        const p = this.picked();
        if (!p) return null;
        return `${diaLabel(p.dia)} ${p.dateLabel} · ${p.hour}`;
    });

    readonly studentLabel = computed<string>(() => {
        const s = this.selectedStudent();
        if (!s) return '';
        return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
    });

    readonly studentInitials = computed<string>(() => {
        const s = this.selectedStudent();
        if (!s) return '';
        return `${(s.nombre[0] ?? '').toUpperCase()}${(s.apellido_paterno[0] ?? '').toUpperCase()}`;
    });

    // ── Form ────────────────────────────────────────────────────
    form: FormGroup = this.fb.group({
        studentQuery: ['', [Validators.required]],
        psicologaId: ['', [Validators.required]],
        date: [null as Date | null, [Validators.required]],
        time: ['', [Validators.required]],
        durationMin: [30, [Validators.required, Validators.min(15), Validators.max(180)]],
        motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    });

    // ── Lifecycle ───────────────────────────────────────────────
    async ngOnInit(): Promise<void> {
        if (this.store.psicologas().length === 0) await this.store.loadPsicologas();

        this.form.get('studentQuery')!.valueChanges.subscribe(
            async (raw: string | StudentOption | null) => {
                if (typeof raw !== 'string') return;
                if (!raw || raw.trim().length < 2) { this.students.set([]); return; }
                this.searching.set(true);
                try {
                    const items = await this.store.searchMyStudents(raw);
                    this.students.set(items);
                } finally {
                    this.searching.set(false);
                }
            },
        );
    }

    // ── Helpers ─────────────────────────────────────────────────
    displayStudent = (s: StudentOption | string): string => {
        if (!s) return '';
        if (typeof s === 'string') return s;
        const fullName = `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
        const gradoSec = [s.grado, s.seccion].filter(Boolean).join(' ');
        return gradoSec ? `${fullName} · ${gradoSec}` : fullName;
    };

    studentInitialsOf(s: StudentOption): string {
        return `${(s.nombre[0] ?? '').toUpperCase()}${(s.apellido_paterno[0] ?? '').toUpperCase()}`;
    }

    psicologaLabel(p: Psicologa): string {
        const esp = p.especialidad ? ` · ${p.especialidad}` : '';
        return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + esp;
    }

    onSelectStudent(s: StudentOption): void {
        this.selectedStudent.set(s);
        this.form.patchValue({ studentQuery: s }, { emitEvent: false });
    }

    clearStudent(): void {
        this.selectedStudent.set(null);
        this.form.patchValue({ studentQuery: '' });
        this.students.set([]);
    }

    // ── Psicóloga / calendar ───────────────────────────────────
    async onPsicologaChange(): Promise<void> {
        this.clearPicked();
        await this.refreshCalendar();
    }

    async onWeekChange(weekStart: string): Promise<void> {
        this.weekStart.set(weekStart);
        this.clearPicked();
        await this.refreshSlotsTaken();
    }

    private async refreshCalendar(): Promise<void> {
        const psicologaId = this.form.value.psicologaId;
        if (!psicologaId) {
            this.availability.set([]);
            this.slotsTaken.set([]);
            return;
        }
        await Promise.all([
            this.refreshAvailability(psicologaId),
            this.refreshSlotsTaken(),
        ]);
        // Importante: NO sintetizamos disponibilidad por defecto. Si la
        // psicóloga todavía no configuró sus bloques, debe verse vacío
        // (empty-state) en lugar de pintar TODOS los slots como disponibles.
    }

    private async refreshAvailability(psicologaId: string): Promise<void> {
        this.loadingAvailability.set(true);
        try {
            this.availability.set(await this.store.getAvailability(psicologaId));
        } catch {
            this.availability.set([]);
        } finally {
            this.loadingAvailability.set(false);
        }
    }

    private async refreshSlotsTaken(): Promise<void> {
        const psicologaId = this.form.value.psicologaId;
        if (!psicologaId) { this.slotsTaken.set([]); return; }
        this.loadingSlots.set(true);
        try {
            this.slotsTaken.set(await this.store.getSlotsTaken(psicologaId, this.weekStart()));
        } catch {
            this.slotsTaken.set([]);
        } finally {
            this.loadingSlots.set(false);
        }
    }

    // (Eliminado) synthesizeIfEmpty: ya no sintetizamos slots fantasma.

    async onSlotPick(ev: BookingPickEvent): Promise<void> {
        const dur = ev.durationMin ?? this.form.value.durationMin ?? 30;
        const longDate =
            `${diaLabel(ev.dia)} ${pad2(ev.date.getDate())}/${pad2(ev.date.getMonth() + 1)}/${ev.date.getFullYear()}`;

        const ok = await firstValueFrom(
            this.dialog.open(ConfirmDialog, {
                width: '380px',
                data: {
                    title: 'Confirmar horario',
                    message:
                        `Fecha: ${longDate}\n` +
                        `Horario: ${ev.hour} – ${ev.endHour} (${dur} min)\n\n` +
                        'La psicóloga recibirá la derivación en estado pendiente.',
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
            durationMin: dur,
        });
    }

    clearPicked(): void {
        this.picked.set(null);
        this.form.patchValue({ date: null, time: '' });
    }

    // ── Submit ──────────────────────────────────────────────────
    cancel(): void { this.ref.close(false); }

    async submit(): Promise<void> {
        const sel = this.selectedStudent();
        if (!sel) {
            this.errorMsg.set('Selecciona un alumno de la lista.');
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

        this.loading.set(true);
        this.errorMsg.set('');
        try {
            await this.store.deriveToPsicologa({
                alumnoId: sel.id,
                psicologaId: v.psicologaId,
                motivo: (v.motivo as string).trim(),
                scheduledAt: scheduled.toISOString(),
                durationMin: v.durationMin,
            });
            this.ref.close(true);
        } catch (err: unknown) {
            this.errorMsg.set(parseApiError(err, 'No se pudo crear la derivación'));
        } finally {
            this.loading.set(false);
        }
    }
}
