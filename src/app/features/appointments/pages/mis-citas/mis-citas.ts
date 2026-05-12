import {
    ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppointmentsStore } from '../../data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import { Appointment, AppointmentEstado } from '../../../../core/models/appointments';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ConfirmDialog, ConfirmData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import type { RequestAppointmentDialogData } from '../../dialogs/request-appointment-dialog/request-appointment-dialog';
import { RequestAppointmentDialog } from '../../dialogs/request-appointment-dialog/request-appointment-dialog';

type EstadoFilter = AppointmentEstado | 'all';

@Component({
    selector: 'app-mis-citas',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        MatButtonModule, MatCardModule, MatChipsModule,
        MatDialogModule, MatDividerModule,
        MatFormFieldModule, MatIconModule, MatInputModule,
        MatProgressSpinnerModule, MatSelectModule,
        MatSnackBarModule, MatTooltipModule,
        EmptyState,
    ],
    templateUrl: './mis-citas.html',
    styleUrls: ['./mis-citas.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisCitas {
    protected readonly store = inject(AppointmentsStore);
    private readonly auth = inject(AuthService);
    private readonly dialog = inject(MatDialog);
    private readonly snack = inject(MatSnackBar);

    readonly mode = computed<'alumno' | 'padre'>(() =>
        this.auth.isPadre() ? 'padre' : 'alumno',
    );

    readonly filterEstado = signal<EstadoFilter>('all');
    readonly search = signal('');

    readonly estados: { value: EstadoFilter; label: string }[] = [
        { value: 'all', label: 'Todos los estados' },
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'confirmada', label: 'Confirmada' },
        { value: 'realizada', label: 'Realizada' },
        { value: 'cancelada', label: 'Cancelada' },
        { value: 'no_asistio', label: 'No asistió' },
    ];

    readonly visible = computed<Appointment[]>(() => {
        const all = this.store.appointments();
        const estado = this.filterEstado();
        const term = this.search().trim().toLowerCase();
        return all.filter(a => {
            if (estado !== 'all' && a.estado !== estado) return false;
            if (term) {
                const stu = this.studentName(a).toLowerCase();
                const psi = this.psicologaName(a).toLowerCase();
                const motivo = (a.motivo ?? '').toLowerCase();
                if (!stu.includes(term) && !psi.includes(term) && !motivo.includes(term)) return false;
            }
            return true;
        }).sort((x, y) =>
            new Date(y.scheduledAt).getTime() - new Date(x.scheduledAt).getTime(),
        );
    });

    readonly upcoming = computed<Appointment[]>(() => {
        const now = Date.now();
        return this.visible().filter(a =>
            new Date(a.scheduledAt).getTime() >= now &&
            (a.estado === 'pendiente' || a.estado === 'confirmada'),
        );
    });

    readonly past = computed<Appointment[]>(() => {
        const now = Date.now();
        return this.visible().filter(a =>
            new Date(a.scheduledAt).getTime() < now ||
            a.estado === 'cancelada' ||
            a.estado === 'realizada' ||
            a.estado === 'no_asistio',
        );
    });

    readonly stats = computed(() => {
        const all = this.store.appointments();
        const now = Date.now();
        return {
            total: all.length,
            upcoming: all.filter(a =>
                new Date(a.scheduledAt).getTime() >= now &&
                (a.estado === 'pendiente' || a.estado === 'confirmada'),
            ).length,
            pending: all.filter(a => a.estado === 'pendiente').length,
            done: all.filter(a => a.estado === 'realizada').length,
        };
    });

    constructor() {
        void this.store.loadMyAppointments();
    }

    studentName(a: Appointment): string {
        const s = a.student;
        if (!s) return '—';
        return `${s.nombre} ${s.apellido_paterno} ${s.apellido_materno ?? ''}`.trim();
    }

    psicologaName(a: Appointment): string {
        const p = a.convocadoA;
        if (!p) return '—';
        return `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno ?? ''}`.trim();
    }

    estadoLabel(estado: AppointmentEstado): string {
        return this.estados.find(e => e.value === estado)?.label ?? estado;
    }

    estadoClass(estado: AppointmentEstado): string { return `chip-${estado}`; }

    modalidadIcon(_modalidad: string): string { return 'meeting_room'; }

    canCancel(a: Appointment): boolean {
        return a.estado !== 'cancelada' && a.estado !== 'realizada';
    }

    /** El usuario puede reagendar si la cita sigue en curso (pendiente/confirmada)
     * y aún no pasó su hora. */
    canReschedule(a: Appointment): boolean {
        if (a.estado !== 'pendiente' && a.estado !== 'confirmada') return false;
        return new Date(a.scheduledAt).getTime() > Date.now();
    }

    trackById = (_: number, a: Appointment): string => a.id;

    openRequest(): void {
        const ref = this.dialog.open(RequestAppointmentDialog, {
            width: '720px',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
            panelClass: 'appointment-dialog-panel',
            data: { mode: this.mode() } as RequestAppointmentDialogData,
        });
        ref.afterClosed().subscribe((ok: boolean) => {
            if (ok) void this.store.loadMyAppointments();
        });
    }

    /** Abre el dialog en modo "reagendar" con la cita actual ya cargada. */
    reagendar(row: Appointment): void {
        const ref = this.dialog.open(RequestAppointmentDialog, {
            width: '720px',
            maxWidth: '95vw',
            autoFocus: 'first-tabbable',
            panelClass: 'appointment-dialog-panel',
            data: {
                mode: this.mode(),
                rescheduleFor: row,
            } as RequestAppointmentDialogData,
        });
        ref.afterClosed().subscribe((ok: boolean) => {
            if (ok) void this.store.loadMyAppointments();
        });
    }

    async cancelar(row: Appointment): Promise<void> {
        const ref = this.dialog.open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, {
            width: '420px',
            maxWidth: '95vw',
            data: {
                title: 'Cancelar cita',
                message: '¿Estás seguro/a de cancelar esta cita?',
                confirm: 'Sí, cancelar',
                cancel: 'Volver',
                danger: true,
            },
        });
        const ok = await firstValueFrom(ref.afterClosed());
        if (!ok) return;
        try {
            await this.store.cancelAppointment(row.id, {
                motivo: this.mode() === 'alumno'
                    ? 'Cancelada por el alumno'
                    : 'Cancelada por el padre/tutor',
            });
            this.snack.open('Cita cancelada', 'OK', { duration: 2500 });
        } catch (err: unknown) {
            this.snack.open(parseApiError(err, 'No se pudo cancelar la cita'), 'OK', { duration: 4500 });
        }
    }
}

function parseApiError(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: unknown } };
    const raw = e?.error?.message;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
        const inner = (raw as { message?: unknown }).message;
        if (typeof inner === 'string') return inner;
        if (Array.isArray(inner) && inner.length > 0 && typeof inner[0] === 'string') return inner.join(', ');
    }
    return fallback;
}