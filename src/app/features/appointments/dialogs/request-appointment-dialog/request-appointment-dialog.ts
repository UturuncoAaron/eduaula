import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ToastService } from 'ngx-toastr-notifier';

import { AppointmentsStore } from '../../data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import {
    AppointmentModalidad,
    AppointmentTipo,
    AvailableSlot,
    Psicologa,
} from '../../../../core/models/psychology';
import { Child } from '../../../../core/models/parent-portal';

export interface RequestAppointmentDialogData {
    /** Modo según el rol del solicitante. */
    mode: 'alumno' | 'padre';
    /** Sólo cuando `mode === 'padre'`: hijo preseleccionado (opcional). */
    preselectedChildId?: string;
}

/** Mismo umbral que valida el backend al crear la cita. */
const MIN_LEAD_MINUTES = 15;
/** Granularidad del select de hora (en minutos). */
const TIME_STEP_MINUTES = 30;
/** Rango horario "trabajable" para el select de hora. */
const WORK_HOUR_START = 7;
const WORK_HOUR_END   = 21;

@Component({
    selector: 'app-request-appointment-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule,
        MatSelectModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatTooltipModule, MatChipsModule,
        MatDatepickerModule,
    ],
    templateUrl: './request-appointment-dialog.html',
    styleUrl: './request-appointment-dialog.scss',
})
export class RequestAppointmentDialog implements OnInit {
    readonly data: RequestAppointmentDialogData = inject(MAT_DIALOG_DATA);
    private ref = inject(MatDialogRef<RequestAppointmentDialog>);
    private fb = inject(FormBuilder);
    readonly store = inject(AppointmentsStore);
    private auth = inject(AuthService);
    private toastr = inject(ToastService);

    // ── Estado UI ──────────────────────────────────────────────────
    loading   = signal(false);
    errorMsg  = signal('');
    slots     = signal<AvailableSlot[]>([]);

    readonly tipos: { value: AppointmentTipo; label: string }[] = [
        { value: 'academico',   label: 'Académico' },
        { value: 'conductual',  label: 'Conductual' },
        { value: 'psicologico', label: 'Psicológico' },
        { value: 'familiar',    label: 'Familiar' },
        { value: 'otro',        label: 'Otro' },
    ];

    readonly modalidades: { value: AppointmentModalidad; label: string }[] = [
        { value: 'presencial', label: 'Presencial' },
        { value: 'virtual',    label: 'Virtual' },
        { value: 'telefonico', label: 'Telefónica' },
    ];

    /** Para padre: hijo seleccionado actual. */
    readonly selectedChild = computed<Child | null>(() => {
        const id = this.form?.value?.childId;
        if (!id) return null;
        return this.store.children().find(c => c.id === id) ?? null;
    });

    readonly selectedPsicologa = computed<Psicologa | null>(() => {
        const id = this.form?.value?.psicologaId;
        if (!id) return null;
        return this.store.psicologas().find(p => p.id === id) ?? null;
    });

    /** Por defecto buscamos slots para los próximos 14 días. */
    private readonly DEFAULT_LOOKAHEAD_DAYS = 14;

    /** Bandera reactiva para recomputar `availableTimes` cuando cambia la fecha. */
    selectedDate = signal<Date | null>(null);

    /** Lista completa de horas (HH:mm) para el select. */
    private readonly allTimes: string[] = buildTimeOptions(
        WORK_HOUR_START, WORK_HOUR_END, TIME_STEP_MINUTES,
    );

    /** Horas disponibles en función de la fecha elegida (filtra pasadas si es hoy). */
    readonly availableTimes = computed<string[]>(() => {
        const d = this.selectedDate();
        if (!d) return this.allTimes;
        if (!isSameDay(d, new Date())) return this.allTimes;
        const minMs = Date.now() + MIN_LEAD_MINUTES * 60_000;
        return this.allTimes.filter(t => combineDateAndTime(d, t).getTime() >= minMs);
    });

    /** Para `[min]` del datepicker: hoy. */
    readonly minDate = startOfDay(new Date());

    form: FormGroup = this.fb.group({
        // Sólo se usa si mode === 'padre'.
        childId:      [this.data.preselectedChildId ?? ''],
        psicologaId:  ['', [Validators.required]],
        tipo:         ['psicologico', [Validators.required]],
        modalidad:    ['presencial', [Validators.required]],
        durationMin:  [30, [Validators.required, Validators.min(15), Validators.max(180)]],
        date:         [null as Date | null, [Validators.required]],
        time:         ['', [Validators.required]],
        motivo:       ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
        priorNotes:   [''],
    });

    async ngOnInit(): Promise<void> {
        if (this.data.mode === 'padre') {
            this.form.get('childId')?.addValidators(Validators.required);
            this.form.get('childId')?.updateValueAndValidity();
            if (this.store.children().length === 0) {
                await this.store.loadChildren();
            }
            if (!this.form.value.childId && this.store.children().length === 1) {
                this.form.patchValue({ childId: this.store.children()[0].id });
            }
        }
        if (this.store.psicologas().length === 0) {
            await this.store.loadPsicologas();
        }
        if (this.store.psicologas().length === 1) {
            this.form.patchValue({ psicologaId: this.store.psicologas()[0].id });
            await this.refreshSlots();
        }
        // Mantenemos el signal sincronizado con el form para que `availableTimes`
        // se recompute al cambiar la fecha desde el calendario.
        this.form.get('date')?.valueChanges.subscribe((d: Date | null) => {
            this.selectedDate.set(d);
            this.recomputeTimeIfNeeded();
        });
    }

    childLabel(c: Child): string {
        return `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno ?? ''}`.trim();
    }

    psicologaLabel(p: Psicologa): string {
        const especialidad = p.especialidad ? ` · ${p.especialidad}` : '';
        return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim() + especialidad;
    }

    formatSlot(iso: string): string {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit',
        });
    }

    async onPsicologaChange() {
        this.form.patchValue({ date: null, time: '' });
        await this.refreshSlots();
    }

    async onDurationChange() {
        this.form.patchValue({ date: null, time: '' });
        await this.refreshSlots();
    }

    pickSlot(iso: string) {
        const d = new Date(iso);
        const date = startOfDay(d);
        const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        this.form.patchValue({ date, time });
    }

    private recomputeTimeIfNeeded() {
        // Si la hora elegida ya no es válida para la fecha actual, la limpiamos.
        const t = this.form.value.time as string;
        if (!t) return;
        if (!this.availableTimes().includes(t)) {
            this.form.patchValue({ time: '' });
        }
    }

    private async refreshSlots(): Promise<void> {
        const psicologaId = this.form.value.psicologaId;
        if (!psicologaId) {
            this.slots.set([]);
            return;
        }
        const from = new Date();
        const to   = new Date();
        to.setDate(to.getDate() + this.DEFAULT_LOOKAHEAD_DAYS);
        const items = await this.store.getAvailableSlots(
            psicologaId,
            from.toISOString(),
            to.toISOString(),
            this.form.value.durationMin || 30,
        );
        this.slots.set(items);
    }

    cancel() { this.ref.close(false); }

    async submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const me = this.auth.currentUser();
        if (!me) {
            this.errorMsg.set('Sesión inválida, vuelve a iniciar sesión.');
            return;
        }
        const v = this.form.value;

        // Validación local de fecha/hora — replica la regla del backend.
        const scheduled = combineDateAndTime(v.date as Date, v.time as string);
        const minStart  = Date.now() + MIN_LEAD_MINUTES * 60_000;
        if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() < minStart) {
            this.errorMsg.set(`La cita debe agendarse con al menos ${MIN_LEAD_MINUTES} minutos de anticipación.`);
            return;
        }

        // El backend rechaza convocarse a uno mismo: protegemos en cliente.
        if (v.psicologaId === me.id) {
            this.errorMsg.set('No puedes convocarte a ti mismo. Selecciona una psicóloga distinta.');
            return;
        }

        // Resolución de IDs según rol del solicitante.
        let studentId = '';
        let parentId: string | undefined;
        if (this.data.mode === 'alumno') {
            studentId = me.id; // alumno agenda para sí mismo
        } else {
            studentId = v.childId;
            parentId  = me.id; // padre se incluye como padre de la cita
        }

        this.loading.set(true);
        this.errorMsg.set('');
        try {
            await this.store.createAppointment({
                convocadoAId: v.psicologaId, // la psicóloga elegida es la convocada
                studentId,
                parentId,
                tipo:         v.tipo,
                modalidad:    v.modalidad,
                motivo:       v.motivo,
                scheduledAt:  scheduled.toISOString(),
                durationMin:  v.durationMin,
                priorNotes:   v.priorNotes || undefined,
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

function pad2(n: number): string {
    return n.toString().padStart(2, '0');
}

function startOfDay(d: Date): Date {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
}

/** Genera ['07:00','07:30',...,'21:00'] según los límites/step configurados. */
function buildTimeOptions(hStart: number, hEnd: number, stepMin: number): string[] {
    const out: string[] = [];
    for (let h = hStart; h <= hEnd; h++) {
        for (let m = 0; m < 60; m += stepMin) {
            if (h === hEnd && m > 0) break;
            out.push(`${pad2(h)}:${pad2(m)}`);
        }
    }
    return out;
}

/** Combina fecha (sólo Y/M/D) + hora 'HH:mm' en una Date local. */
function combineDateAndTime(date: Date, time: string): Date {
    const [hh, mm] = time.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hh ?? 0, mm ?? 0, 0, 0);
    return d;
}

/**
 * Acepta los formatos del `HttpExceptionFilter` del backend
 * (`{ message: string }` o `{ message: { message: string | string[] } }`)
 * y devuelve siempre un string para mostrar.
 */
function parseApiError(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: unknown } };
    const raw = e?.error?.message;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
        const inner = (raw as { message?: unknown }).message;
        if (typeof inner === 'string') return inner;
        if (Array.isArray(inner) && inner.length > 0 && typeof inner[0] === 'string') {
            return inner.join(', ');
        }
    }
    return fallback;
}
