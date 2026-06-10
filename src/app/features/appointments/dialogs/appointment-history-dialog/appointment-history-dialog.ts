import {
    ChangeDetectionStrategy, Component, OnInit,
    computed, inject, signal,
} from '@angular/core';
import {
    MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';

import { AppointmentsStore } from '../../data-access/appointments.store';
import {
    Appointment, AppointmentEstado, AppointmentStatusLogEntry,
} from '../../../../core/models/appointments';

export interface AppointmentHistoryDialogData {
    appointment: Appointment;
}

/**
 * Drawer/timeline que muestra el detalle COMPLETO de una cita:
 *   • Header con resumen (con quién, alumno, fecha, tipo, modalidad, duración).
 *   • Motivo + notas previas/posteriores.
 *   • Bloque de cancelación con motivo destacado.
 *   • Timeline append-only con cada cambio de estado (consume
 *     `GET /appointments/:id/estado-log` via `getStatusLog` en el store).
 */
@Component({
    selector: 'app-appointment-history-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatDialogModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './appointment-history-dialog.html',
    styleUrl: './appointment-history-dialog.scss',
})
export class AppointmentHistoryDialog implements OnInit {
    private ref = inject(MatDialogRef<AppointmentHistoryDialog>);
    private store = inject(AppointmentsStore);
    readonly data: AppointmentHistoryDialogData = inject(MAT_DIALOG_DATA);

    readonly loading = signal(true);
    readonly entries = signal<AppointmentStatusLogEntry[]>([]);

    readonly hasEntries = computed(() => this.entries().length > 0);

    async ngOnInit(): Promise<void> {
        this.loading.set(true);
        try {
            const log = await this.store.getStatusLog(this.data.appointment.id);
            this.entries.set(log);
        } finally {
            this.loading.set(false);
        }
    }

    close(): void { this.ref.close(); }

    /** Etiqueta corta del estado para mostrar en cada paso del timeline. */
    estadoLabel(e: AppointmentEstado | null): string {
        if (!e) return 'creación';
        const m: Record<AppointmentEstado, string> = {
            pendiente: 'Pendiente',
            confirmada: 'Confirmada',
            realizada: 'Realizada',
            cancelada: 'Cancelada',
            rechazada: 'Rechazada',
            no_asistio: 'No asistió',
        };
        return m[e] ?? e;
    }

    /** Color del bullet del timeline según el estado destino. */
    estadoTone(e: AppointmentEstado): 'pending' | 'ok' | 'warn' | 'danger' | 'muted' {
        switch (e) {
            case 'pendiente': return 'pending';
            case 'confirmada': return 'ok';
            case 'realizada': return 'ok';
            case 'cancelada': return 'danger';
            case 'rechazada': return 'danger';
            case 'no_asistio': return 'warn';
            default: return 'muted';
        }
    }

    authorLabel(entry: AppointmentStatusLogEntry): string {
        if (!entry.changedBy) return 'Sistema';
        const name = `${entry.changedBy.nombre} ${entry.changedBy.apellido_paterno}`.trim();
        return entry.changedBy.rol ? `${name} · ${entry.changedBy.rol}` : name;
    }

    // ── Helpers para el resumen de la cita ──────────────────────

    readonly appointmentInfo = computed(() => this.data.appointment);

    readonly convocadoLabel = computed(() => {
        const c = this.data.appointment.convocadoA;
        if (!c) return '—';
        const full = `${c.nombre} ${c.apellido_paterno}`.trim();
        return c.rol ? `${full} · ${c.rol}` : full;
    });

    readonly convocadorLabel = computed(() => {
        const c = this.data.appointment.convocadoPor;
        if (!c) return '—';
        const full = `${c.nombre} ${c.apellido_paterno}`.trim();
        return c.rol ? `${full} · ${c.rol}` : full;
    });

    readonly studentLabel = computed(() => {
        const s = this.data.appointment.student;
        if (!s) return '—';
        return `${s.nombre} ${s.apellido_paterno}`.trim();
    });

    readonly isCancelada = computed(() => {
        const e = this.data.appointment.estado;
        return e === 'cancelada' || e === 'rechazada';
    });
    formatPriorNotes(notes: string | null): string {
        if (!notes) return '';
        return notes.replace(
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z/g,
            (isoDate) => new Date(isoDate).toLocaleString('es-PE', {
                timeZone: 'America/Lima',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
        );
    }
}
