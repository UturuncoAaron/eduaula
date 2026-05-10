import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import {
    Appointment,
    AccountAvailability,
    SlotTaken,
    CreateAppointmentPayload,
    UpdateAppointmentPayload,
    CancelAppointmentPayload,
    SetAvailabilityPayload,
} from '../../../core/models/appointments';
import { Psicologa, Docente } from '../../../core/models/psychology';
import { Child } from '../../../core/models/parent-portal';

function unwrapList<T>(payload: T[] | { data?: T[] } | null | undefined): T[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray((payload as { data?: T[] }).data)) {
        return (payload as { data: T[] }).data;
    }
    return [];
}

@Injectable({ providedIn: 'root' })
export class AppointmentsStore {
    private api = inject(ApiService);

    // ── Estado ──────────────────────────────────────────────────
    readonly appointments = signal<Appointment[]>([]);
    readonly availability = signal<AccountAvailability[]>([]);
    readonly psicologas = signal<Psicologa[]>([]);
    readonly docentes = signal<Docente[]>([]);
    readonly children = signal<Child[]>([]);

    readonly loadingAppointments = signal(false);
    readonly loadingAvailability = signal(false);
    readonly loadingPsicologas = signal(false);
    readonly loadingDocentes = signal(false);
    readonly loadingChildren = signal(false);
    readonly error = signal<string | null>(null);

    reset(): void {
        this.appointments.set([]);
        this.availability.set([]);
        this.psicologas.set([]);
        this.docentes.set([]);
        this.children.set([]);
        this.error.set(null);
    }

    // ════════════════════════════════════════════════════════════
    // CITAS
    // ════════════════════════════════════════════════════════════

    async loadMyAppointments(): Promise<void> {
        this.loadingAppointments.set(true);
        this.error.set(null);
        try {
            const res = await firstValueFrom(
                this.api.get<Appointment[] | { data: Appointment[] }>('appointments/mine'),
            );
            this.appointments.set(unwrapList<Appointment>(res.data));
        } catch {
            this.error.set('Error al cargar las citas');
        } finally {
            this.loadingAppointments.set(false);
        }
    }

    async createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.post<Appointment>('appointments', payload),
        );
        await this.loadMyAppointments();
        return res.data;
    }

    async updateAppointment(
        id: string,
        payload: UpdateAppointmentPayload,
    ): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`appointments/${id}`, payload),
        );
        await this.loadMyAppointments();
        return res.data;
    }

    async cancelAppointment(
        id: string,
        payload: CancelAppointmentPayload,
    ): Promise<void> {
        await firstValueFrom(this.api.delete(`appointments/${id}`, payload));
        await this.loadMyAppointments();
    }

    /** Slots ocupados de un profesional en la semana del `weekStart`. */
    async getSlotsTaken(cuentaId: string, date: string): Promise<SlotTaken[]> {
        try {
            const res = await firstValueFrom(
                this.api.get<SlotTaken[] | { data: SlotTaken[] }>(
                    `appointments/slots-taken/${cuentaId}`,
                    { date },
                ),
            );
            return unwrapList<SlotTaken>(res.data);
        } catch {
            return [];
        }
    }

    // ════════════════════════════════════════════════════════════
    // DISPONIBILIDAD
    // ════════════════════════════════════════════════════════════

    /** Carga la disponibilidad en signal (usado por tab-disponibilidad). */
    async loadAvailability(cuentaId: string): Promise<void> {
        this.loadingAvailability.set(true);
        this.error.set(null);
        try {
            const res = await firstValueFrom(
                this.api.get<AccountAvailability[] | { data: AccountAvailability[] }>(
                    `appointments/availability/${cuentaId}`,
                ),
            );
            this.availability.set(unwrapList<AccountAvailability>(res.data));
        } catch {
            this.error.set('Error al cargar la disponibilidad');
        } finally {
            this.loadingAvailability.set(false);
        }
    }

    /** Fetcher puro, no toca el signal — para BookingCalendar. */
    async getAvailability(cuentaId: string): Promise<AccountAvailability[]> {
        try {
            const res = await firstValueFrom(
                this.api.get<AccountAvailability[] | { data: AccountAvailability[] }>(
                    `appointments/availability/${cuentaId}`,
                ),
            );
            return unwrapList<AccountAvailability>(res.data);
        } catch {
            return [];
        }
    }

    async setAvailability(payload: SetAvailabilityPayload): Promise<AccountAvailability> {
        const res = await firstValueFrom(
            this.api.post<AccountAvailability>('appointments/availability', payload),
        );
        return res.data;
    }

    async toggleAvailability(id: string): Promise<AccountAvailability> {
        const res = await firstValueFrom(
            this.api.patch<AccountAvailability>(
                `appointments/availability/${id}/toggle`, {},
            ),
        );
        return res.data;
    }

    async removeAvailability(id: string): Promise<void> {
        await firstValueFrom(this.api.delete(`appointments/availability/${id}`));
    }

    // ════════════════════════════════════════════════════════════
    // DIRECTORIO DE PROFESIONALES
    // ════════════════════════════════════════════════════════════

    async loadPsicologas(query?: string): Promise<void> {
        this.loadingPsicologas.set(true);
        try {
            const params = query ? { q: query } : undefined;
            const res = await firstValueFrom(
                this.api.get<Psicologa[] | { data: Psicologa[] }>(
                    'psychology/psicologas', params,
                ),
            );
            this.psicologas.set(unwrapList<Psicologa>(res.data));
        } catch {
            this.psicologas.set([]);
        } finally {
            this.loadingPsicologas.set(false);
        }
    }

    /**
     * Lista docentes para selects. Usa `admin/users/docentes/select`.
     * Asegúrate de relajar el `@Roles('admin')` en el backend para esta
     * ruta específica (snippet en el chat).
     */
    async loadDocentes(): Promise<void> {
        this.loadingDocentes.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<Docente[] | { data: Docente[] }>(
                    'admin/users/docentes/select',
                ),
            );
            this.docentes.set(unwrapList<Docente>(res.data));
        } catch {
            this.docentes.set([]);
        } finally {
            this.loadingDocentes.set(false);
        }
    }

    async loadChildren(): Promise<void> {
        this.loadingChildren.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<Child[] | { data: Child[] }>('parent/children'),
            );
            this.children.set(unwrapList<Child>(res.data));
        } catch {
            this.children.set([]);
        } finally {
            this.loadingChildren.set(false);
        }
    }
    // ── Alumnos del docente (autocomplete simple) ──────────────────────────
    async searchMyStudents(query: string): Promise<{
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
        grado: string;
        seccion: string;
        padre?: { id: string; nombre: string; apellido_paterno: string } | null;
    }[]> {
        if (!query || query.trim().length < 2) return [];
        try {
            const res = await firstValueFrom(
                this.api.get<any[] | { data: any[] }>('teacher/students/search', { q: query }),
            );
            return unwrapList<any>(res.data);
        } catch {
            return [];
        }
    }
    /** Reemplaza atómicamente toda mi disponibilidad. */
    async replaceMyAvailability(
        items: { diaSemana: string; horaInicio: string; horaFin: string }[],
    ): Promise<AccountAvailability[]> {
        const res = await firstValueFrom(
            this.api.put<AccountAvailability[] | { data: AccountAvailability[] }>(
                'appointments/availability/bulk',
                { items },
            ),
        );
        return unwrapList<AccountAvailability>(res.data);
    }
}