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
import { ToastService } from 'ngx-toastr-notifier';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AppointmentsStore } from '../../data-access/appointments.store';
import { AuthService } from '../../../../core/auth/auth';
import { Appointment, AppointmentEstado } from '../../../../core/models/appointments';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { RejectDialog, RejectDialogData, RejectDialogResult } from '../../../../shared/components/reject-dialog/reject-dialog';
import type { RequestAppointmentDialogData } from '../../dialogs/request-appointment-dialog/request-appointment-dialog';
import { RequestAppointmentDialog } from '../../dialogs/request-appointment-dialog/request-appointment-dialog';
import {
    PostponeAppointmentDialog, PostponeDialogData, PostponeDialogResult,
} from '../../dialogs/postpone-appointment-dialog/postpone-appointment-dialog';
import {
    AppointmentHistoryDialog, AppointmentHistoryDialogData,
} from '../../dialogs/appointment-history-dialog/appointment-history-dialog';
import { parseApiError } from '../../../../shared/utils/api-errors';

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
        MatTooltipModule,
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
    private readonly toastr = inject(ToastService);

    readonly mode = computed<'alumno' | 'padre'>(() =>
        this.auth.isPadre() ? 'padre' : 'alumno',
    );

    readonly filterEstado = signal<EstadoFilter>('all');
    readonly search = signal('');
    /**
     * Historial colapsado por defecto. El usuario lo abre solo si quiere
     * revisar citas pasadas/canceladas. Evita que la página luzca llena
     * de basura histórica desde el primer load.
     */
    readonly historialOpen = signal(false);

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
        return a.estado !== 'cancelada' && a.estado !== 'realizada' &&
            a.estado !== 'rechazada' && a.estado !== 'no_asistio';
    }

    /** El usuario puede reagendar si la cita sigue en curso (pendiente/confirmada)
     * y aún no pasó su hora. */
    canReschedule(a: Appointment): boolean {
        if (a.estado !== 'pendiente' && a.estado !== 'confirmada') return false;
        return new Date(a.scheduledAt).getTime() > Date.now();
    }

    /**
     * Puede confirmar la cita: sólo el convocado, y sólo si está en
     * estado pendiente y aún no pasó su hora.
     */
    canConfirm(a: Appointment): boolean {
        if (a.estado !== 'pendiente') return false;
        const me = this.auth.currentUser()?.id;
        if (a.convocadoAId !== me) return false;
        return new Date(a.scheduledAt).getTime() > Date.now();
    }

    /**
     * El padre puede rechazar (sólo padre, y sólo cuando es el convocado).
     * El alumno cancela en su lugar.
     */
    canReject(a: Appointment): boolean {
        if (this.mode() !== 'padre') return false;
        if (a.estado !== 'pendiente') return false;
        const me = this.auth.currentUser()?.id;
        return a.convocadoAId === me;
    }

    /**
     * Puede aplazar (proponer nueva fecha + motivo): el convocado, mientras
     * la cita siga viva.
     *
     * Spec (Aarón, 2026-05): el ALUMNO no puede aplazar nunca. Si necesita
     * mover una cita debe cancelarla (con motivo) y volver a solicitarla.
     */
    canPostpone(a: Appointment): boolean {
        if (this.mode() === 'alumno') return false;
        if (a.estado !== 'pendiente' && a.estado !== 'confirmada') return false;
        const me = this.auth.currentUser()?.id;
        if (a.convocadoAId !== me) return false;
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
        // Pedimos motivo explícito — el BE exige `motivo` no vacío en /cancelar.
        const data: RejectDialogData = { contextLabel: this.contextLabel(row) };
        const res = await firstValueFrom(
            this.dialog.open<RejectDialog, RejectDialogData, RejectDialogResult>(
                RejectDialog,
                { data, width: '440px', maxWidth: '95vw' },
            ).afterClosed(),
        );
        if (!res?.motivo) return;
        try {
            await this.store.cancelAppointment(row.id, { motivo: res.motivo });
            this.toastr.success('Cita cancelada', 'OK', { duration: 2500 });
        } catch (err: unknown) {
            this.toastr.error(parseApiError(err, 'No se pudo cancelar la cita'), 'Error', { duration: 4500 });
        }
    }

    async confirmar(row: Appointment): Promise<void> {
        try {
            await this.store.confirmAppointment(row.id);
            this.toastr.success('Cita confirmada', 'OK', { duration: 2500 });
        } catch (err: unknown) {
            this.toastr.error(parseApiError(err, 'No se pudo confirmar la cita'), 'Error', { duration: 4500 });
        }
    }

    async rechazar(row: Appointment): Promise<void> {
        const data: RejectDialogData = { contextLabel: this.contextLabel(row) };
        const res = await firstValueFrom(
            this.dialog.open<RejectDialog, RejectDialogData, RejectDialogResult>(
                RejectDialog,
                { data, width: '440px', maxWidth: '95vw' },
            ).afterClosed(),
        );
        if (!res?.motivo) return;
        try {
            await this.store.rejectAppointment(row.id, res.motivo);
            this.toastr.success('Cita rechazada', 'OK', { duration: 2500 });
        } catch (err: unknown) {
            this.toastr.error(parseApiError(err, 'No se pudo rechazar la cita'), 'Error', { duration: 4500 });
        }
    }

    /** Abre el drawer con el historial completo de cambios de estado. */
    openHistory(row: Appointment): void {
        this.dialog.open<AppointmentHistoryDialog, AppointmentHistoryDialogData, void>(
            AppointmentHistoryDialog,
            {
                width: '560px',
                maxWidth: '95vw',
                autoFocus: 'first-tabbable',
                data: { appointment: row },
            },
        );
    }

    async aplazar(row: Appointment): Promise<void> {
        const ref = this.dialog.open<PostponeAppointmentDialog, PostponeDialogData, PostponeDialogResult>(
            PostponeAppointmentDialog,
            {
                width: '880px',
                maxWidth: '95vw',
                panelClass: 'appointment-dialog-panel',
                data: { appointment: row },
            },
        );
        const result = await firstValueFrom(ref.afterClosed());
        if (result?.success) {
            this.toastr.success('Cita aplazada — el convocante recibirá una notificación', 'OK', { duration: 3000 });
            void this.store.loadMyAppointments();
        }
    }

    /** Texto descriptivo "13/05 a las 10:30 con X" para los dialogs de rechazo/cancelar. */
    private contextLabel(a: Appointment): string {
        const d = new Date(a.scheduledAt);
        const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        const con = this.psicologaName(a) || this.studentName(a) || '—';
        return `${fecha} a las ${hora} con ${con}`;
    }
}