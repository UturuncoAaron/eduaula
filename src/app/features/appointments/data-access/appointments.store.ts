import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import {
    Appointment,
    AvailableSlot,
    CancelAppointmentPayload,
    CreateAppointmentPayload,
    Psicologa,
} from '../../../core/models/psychology';
import { Child } from '../../../core/models/parent-portal';

/**
 * Algunos endpoints devuelven el array directamente y otros lo envuelven en
 * `{ data, total, page, limit, totalPages }`. Soporta ambos formatos.
 */
function unwrapList<T>(payload: T[] | { data?: T[] } | null | undefined): T[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray((payload as { data?: T[] }).data)) {
        return (payload as { data: T[] }).data;
    }
    return [];
}

/**
 * Store dedicado al flujo de "Mis Citas" para alumno/padre.
 *
 * No reemplaza al `PsychologyStore` (vista interna de la psicóloga); se enfoca
 * en lo que necesitan los roles externos para listar/cancelar/solicitar
 * citas reusando los endpoints existentes:
 *
 *   GET    /appointments/mine           — listar mis citas
 *   POST   /appointments                — crear cita (rol valida en backend)
 *   DELETE /appointments/:id            — cancelar (con motivo)
 *   GET    /psychology/psicologas       — listar psicólogas activas
 *   GET    /psychology/slots/:id        — slots disponibles
 *   GET    /parent/children             — hijos del padre (sólo padre)
 */
@Injectable({ providedIn: 'root' })
export class AppointmentsStore {
    private api = inject(ApiService);

    // ── Estado ────────────────────────────────────────────────────
    readonly appointments = signal<Appointment[]>([]);
    readonly psicologas   = signal<Psicologa[]>([]);
    readonly children     = signal<Child[]>([]);

    readonly loadingAppointments = signal(false);
    readonly loadingPsicologas   = signal(false);
    readonly loadingChildren     = signal(false);
    readonly loadingSlots        = signal(false);
    readonly error               = signal<string | null>(null);

    reset(): void {
        this.appointments.set([]);
        this.psicologas.set([]);
        this.children.set([]);
        this.error.set(null);
    }

    // ── APPOINTMENTS ──────────────────────────────────────────────

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

    async cancelAppointment(id: string, payload: CancelAppointmentPayload): Promise<void> {
        await firstValueFrom(this.api.delete(`appointments/${id}`, payload));
        await this.loadMyAppointments();
    }

    // ── PSICOLOGAS (directorio público) ───────────────────────────

    async loadPsicologas(): Promise<void> {
        this.loadingPsicologas.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<Psicologa[] | { data: Psicologa[] }>('psychology/psicologas'),
            );
            this.psicologas.set(unwrapList<Psicologa>(res.data));
        } catch {
            // Si el back devuelve 403/404 dejamos vacío para que la UI lo
            // detecte y muestre fallback ("Sin psicólogas disponibles").
            this.psicologas.set([]);
        } finally {
            this.loadingPsicologas.set(false);
        }
    }

    // ── CHILDREN (sólo padre) ─────────────────────────────────────

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

    // ── SLOTS DISPONIBLES ─────────────────────────────────────────

    async getAvailableSlots(
        psychologistId: string,
        fromIso: string,
        toIso: string,
        durationMin?: number,
    ): Promise<AvailableSlot[]> {
        this.loadingSlots.set(true);
        try {
            const params: Record<string, string> = { from: fromIso, to: toIso };
            if (durationMin) params['durationMin'] = String(durationMin);
            const res = await firstValueFrom(
                this.api.get<AvailableSlot[] | { data: AvailableSlot[] }>(
                    `psychology/slots/${psychologistId}`,
                    params,
                ),
            );
            return unwrapList<AvailableSlot>(res.data);
        } catch {
            return [];
        } finally {
            this.loadingSlots.set(false);
        }
    }
}
