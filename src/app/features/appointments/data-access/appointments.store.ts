import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
    Appointment,
    AccountAvailability,
    SetAvailabilityPayload,
    CreateAppointmentPayload,
    UpdateAppointmentPayload,
    CancelAppointmentPayload,
    ListAppointmentsQuery,
    SlotTaken,
    AppointmentEstado,
} from '../../../core/models/appointments';
import type { Psicologa } from '../../../core/models/psychology';
import type { Child }     from '../../../core/models/parent-portal';
import { ApiService } from '@core/services/api';

// ── Tipo Docente para el select de profesionales ─────────────────
export interface DocenteSelectItem {
    id:               string;
    nombre:           string;
    apellido_paterno: string;
    apellido_materno: string | null;
    especialidad:     string | null;
    foto_url:         string | null;
}

// ── Re-exports — para componentes que importan tipos desde el store
export type {
    Appointment,
    AccountAvailability,
    SetAvailabilityPayload,
    CreateAppointmentPayload,
    UpdateAppointmentPayload,
    CancelAppointmentPayload,
    ListAppointmentsQuery,
    SlotTaken,
    AppointmentEstado,
} from '../../../core/models/appointments';

export type { Psicologa } from '../../../core/models/psychology';
export type { Child }     from '../../../core/models/parent-portal';
function unwrapList<T>(payload: T[] | { data?: T[] } | null | undefined): T[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray((payload as { data?: T[] }).data)) {
        return (payload as { data: T[] }).data;
    }
    return [];
}

// ── Store ─────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AppointmentsStore {
    private api = inject(ApiService);

    // ── Signals ──────────────────────────────────────────────────
    readonly appointments        = signal<Appointment[]>([]);
    readonly availability        = signal<AccountAvailability[]>([]);
    readonly docentes            = signal<DocenteSelectItem[]>([]);
    readonly psicologas          = signal<Psicologa[]>([]);
    readonly children            = signal<Child[]>([]);

    readonly loading             = signal(false);
    readonly loadingAppointments = signal(false);
    readonly loadingAvailability = signal(false);
    readonly loadingDocentes     = signal(false);
    readonly loadingPsicologas   = signal(false);
    readonly loadingChildren     = signal(false);

    readonly error               = signal<string | null>(null);

    reset(): void {
        this.appointments.set([]);
        this.availability.set([]);
        this.docentes.set([]);
        this.psicologas.set([]);
        this.children.set([]);
        this.error.set(null);
    }

    // ════════════════════════════════════════════════════════════
    // CITAS
    // ════════════════════════════════════════════════════════════

    async loadMine(q: ListAppointmentsQuery): Promise<void> {
        this.loading.set(true);
        this.loadingAppointments.set(true);
        this.error.set(null);
        try {
            const params = Object.fromEntries(
                Object.entries(q)
                    .filter(([, v]) => v !== undefined && v !== null)
                    .map(([k, v]) => [k, String(v)]),
            ) as Record<string, string>;

            const res = await firstValueFrom(
                this.api.get<Appointment[] | { data: Appointment[] }>(
                    'appointments/mine',
                    params,
                ),
            );
            this.appointments.set(unwrapList<Appointment>(res.data));
        } catch {
            this.error.set('Error al cargar las citas');
        } finally {
            this.loading.set(false);
            this.loadingAppointments.set(false);
        }
    }

    // Alias — compatibilidad con componentes que llaman loadMyAppointments()
    async loadMyAppointments(): Promise<void> {
        return this.loadMine({});
    }

    async createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.post<Appointment>('appointments', payload),
        );
        await this.loadMine({});
        return res.data;
    }

    async updateAppointment(
        id: string,
        payload: UpdateAppointmentPayload,
    ): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`appointments/${id}`, payload),
        );
        this.appointments.update(list =>
            list.map(c => c.id === id ? { ...c, ...payload } : c),
        );
        return res.data;
    }

    async cancelAppointment(
        id: string,
        payload: CancelAppointmentPayload,
    ): Promise<void> {
        await firstValueFrom(
            this.api.delete(`appointments/${id}`, payload as Record<string, string>),
        );
        this.appointments.update(list =>
            list.map(c =>
                c.id === id
                    ? { ...c, estado: 'cancelada' as AppointmentEstado }
                    : c,
            ),
        );
    }

    /** Acepta una cita pendiente (la convierte en confirmada). Solo el convocado. */
    async acceptAppointment(id: string): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.post<Appointment>(`appointments/${id}/accept`, {}),
        );
        this.appointments.update(list =>
            list.map(c => c.id === id ? { ...c, estado: 'confirmada' } : c),
        );
        return res.data;
    }

    /** Rechaza una cita pendiente, dejando el motivo. Solo el convocado. */
    async rejectAppointment(id: string, motivo: string): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.post<Appointment>(`appointments/${id}/reject`, { motivo }),
        );
        this.appointments.update(list =>
            list.map(c =>
                c.id === id
                    ? { ...c, estado: 'rechazada', cancelReason: motivo }
                    : c,
            ),
        );
        return res.data;
    }

    async getSlotsTaken(cuentaId: string, date: string): Promise<SlotTaken[]> {
        try {
            const res = await firstValueFrom(
                this.api.get<SlotTaken[] | { data: SlotTaken[] }>(
                    `appointments/slots-taken/${cuentaId}`,
                    { date } as Record<string, string>,
                ),
            );
            return unwrapList<SlotTaken>(res.data);
        } catch {
            return [];
        }
    }

    // ════════════════════════════════════════════════════════════
    // DISPONIBILIDAD  →  tabla: disponibilidad_cuenta
    // ════════════════════════════════════════════════════════════

    async loadAvailability(cuentaId: string): Promise<void> {
        this.loadingAvailability.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<AccountAvailability[] | { data: AccountAvailability[] }>(
                    `appointments/availability/${cuentaId}`,
                ),
            );
            this.availability.set(unwrapList<AccountAvailability>(res.data));
        } catch {
            this.availability.set([]);
        } finally {
            this.loadingAvailability.set(false);
        }
    }

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

    async replaceMyAvailability(
        items: SetAvailabilityPayload[],
    ): Promise<AccountAvailability[]> {
        const res = await firstValueFrom(
            this.api.put<AccountAvailability[] | { data: AccountAvailability[] }>(
                'appointments/availability/bulk',
                { items },
            ),
        );
        return unwrapList<AccountAvailability>(res.data);
    }

    // ════════════════════════════════════════════════════════════
    // DIRECTORIOS
    // ════════════════════════════════════════════════════════════

    async loadDocentes(): Promise<void> {
        if (this.loadingDocentes()) return;
        this.loadingDocentes.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<DocenteSelectItem[] | { data: DocenteSelectItem[] }>(
                    'admin/users/docentes/select',
                ),
            );
            this.docentes.set(unwrapList<DocenteSelectItem>(res.data));
        } catch {
            this.docentes.set([]);
        } finally {
            this.loadingDocentes.set(false);
        }
    }

    async loadPsicologas(): Promise<void> {
        if (this.loadingPsicologas()) return;
        this.loadingPsicologas.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<Psicologa[] | { data: Psicologa[] }>(
                    'psychology/psicologas',
                ),
            );
            this.psicologas.set(unwrapList<Psicologa>(res.data));
        } catch {
            this.psicologas.set([]);
        } finally {
            this.loadingPsicologas.set(false);
        }
    }

    async loadChildren(): Promise<void> {
        if (this.loadingChildren()) return;
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

    // ════════════════════════════════════════════════════════════
    // SEARCH — TeacherRequestAppointmentDialog
    // ════════════════════════════════════════════════════════════

    async searchMyStudents(query: string): Promise<{
        id:               string;
        nombre:           string;
        apellido_paterno: string;
        apellido_materno: string | null;
        grado:            string;
        seccion:          string;
        padre?: {
            id:               string;
            nombre:           string;
            apellido_paterno: string;
        } | null;
    }[]> {
        if (!query || query.trim().length < 2) return [];
        try {
            const res = await firstValueFrom(
                this.api.get<any[] | { data: any[] }>(
                    'teacher/students/search',
                    { q: query } as Record<string, string>,
                ),
            );
            return unwrapList<any>(res.data);
        } catch {
            return [];
        }
    }
}