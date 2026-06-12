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
    AppointmentRoleRule,
    FreeSlot,
    PostponeAppointmentPayload,
    DeriveAppointmentPayload,
    CompleteAppointmentPayload,
    CreateAppointmentResult,
    WeeklyAvailability,
    SlotConflictResponse,
    AppointmentStatusLogEntry,
    DayBlocksResponse,
    FollowUpSuggestion,
    CloseSessionPayload,
    CloseSessionResult,
    AvailabilityOverrideDay,
    ReplaceOverridesResult,
} from '../../../core/models/appointments';
import type { Psicologa } from '../../../core/models/psychology';
import type { Child } from '../../../core/models/parent-portal';
import { ApiService } from '@core/services/api';

// ── Tipo Docente para el select de profesionales ─────────────────
export interface DocenteSelectItem {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    especialidad: string | null;
    foto_url: string | null;
}

// ── Tipo Administrador/Directivo para el select de profesionales ──
export interface AdminSelectItem {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    cargo: string | null;
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
    FreeSlot,
    PostponeAppointmentPayload,
    DeriveAppointmentPayload,
    CompleteAppointmentPayload,
    CreateAppointmentResult,
    WeeklyAvailability,
    AffectedAppointment,
    SlotConflictResponse,
    AvailableParent,
    DayBlocksResponse,
    FollowUpSuggestion,
    CloseSessionPayload,
    CloseSessionResult,
    AvailabilityOverrideDay,
    ReplaceOverridesResult,
} from '../../../core/models/appointments';

export type { Psicologa } from '../../../core/models/psychology';
export type { Child } from '../../../core/models/parent-portal';

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
    readonly appointments = signal<Appointment[]>([]);
    readonly availability = signal<AccountAvailability[]>([]);
    readonly docentes = signal<DocenteSelectItem[]>([]);
    readonly admins = signal<AdminSelectItem[]>([]);
    readonly psicologas = signal<Psicologa[]>([]);
    readonly children = signal<Child[]>([]);

    readonly loading = signal(false);
    readonly loadingAppointments = signal(false);
    readonly loadingAvailability = signal(false);
    readonly loadingDocentes = signal(false);
    readonly loadingAdmins = signal(false);
    readonly loadingPsicologas = signal(false);
    readonly loadingChildren = signal(false);

    readonly error = signal<string | null>(null);

    reset(): void {
        this.appointments.set([]);
        this.availability.set([]);
        this.docentes.set([]);
        this.admins.set([]);
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

    async loadMyAppointments(): Promise<void> {
        return this.loadMine({});
    }

    async createAppointment(
        payload: CreateAppointmentPayload,
    ): Promise<CreateAppointmentResult> {
        const res = await firstValueFrom(
            this.api.post<CreateAppointmentResult>('appointments', payload),
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
            this.api.patch<Appointment>(`appointments/${id}/cancelar`, {
                motivo: payload.motivo ?? '',
            }),
        );
        this.appointments.update(list =>
            list.map(c =>
                c.id === id
                    ? {
                        ...c,
                        estado: 'cancelada' as AppointmentEstado,
                        cancelReason: payload.motivo ?? c.cancelReason,
                    }
                    : c,
            ),
        );
    }

    async confirmAppointment(id: string): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`appointments/${id}/confirmar`, {}),
        );
        this.appointments.update(list =>
            list.map(c => c.id === id ? { ...c, estado: 'confirmada' } : c),
        );
        return res.data;
    }

    acceptAppointment(id: string): Promise<Appointment> {
        return this.confirmAppointment(id);
    }

    async rejectAppointment(id: string, motivo: string): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`appointments/${id}/rechazar`, { motivo }),
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

    async postponeAppointment(
        id: string,
        payload: PostponeAppointmentPayload,
    ): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`appointments/${id}/aplazar`, payload),
        );
        await this.loadMine({});
        return res.data;
    }

    async markAsRealizada(
        id: string,
        payload: CompleteAppointmentPayload = {},
    ): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`appointments/${id}/realizar`, payload),
        );
        this.appointments.update(list =>
            list.map(c =>
                c.id === id
                    ? {
                        ...c,
                        estado: 'realizada',
                        followUpNotes: payload.notasPosteriores ?? c.followUpNotes,
                    }
                    : c,
            ),
        );
        return res.data;
    }

    async markAsNoAsistio(id: string): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.patch<Appointment>(`appointments/${id}/inasistencia`, {}),
        );
        this.appointments.update(list =>
            list.map(c => c.id === id ? { ...c, estado: 'no_asistio' } : c),
        );
        return res.data;
    }

    async deriveToPsicologa(
        payload: DeriveAppointmentPayload,
    ): Promise<Appointment> {
        const res = await firstValueFrom(
            this.api.post<Appointment>('appointments/derivar', payload),
        );
        await this.loadMine({});
        return res.data;
    }

    async deleteAvailabilitySlot(
        slotId: string,
        confirm = false,
    ): Promise<{ ok: true } | SlotConflictResponse> {
        try {
            await firstValueFrom(
                this.api.delete(
                    `appointments/availability/slot/${slotId}`,
                    undefined,
                    confirm ? { confirm: 'true' } : undefined,
                ),
            );
            return { ok: true };
        } catch (err: unknown) {
            const e = err as {
                status?: number;
                error?: {
                    statusCode?: number;
                    message?: Partial<SlotConflictResponse> | string;
                };
            };
            if (e?.status === 409) {
                const body = e.error?.message;
                if (body && typeof body === 'object' && 'affected' in body) {
                    return {
                        statusCode: 409,
                        message: (body as SlotConflictResponse).message ?? 'Hay citas activas en este bloque.',
                        affectedCount: (body as SlotConflictResponse).affectedCount ?? 0,
                        affected: (body as SlotConflictResponse).affected ?? [],
                    } satisfies SlotConflictResponse;
                }
            }
            throw err;
        }
    }

    async getStatusLog(appointmentId: string): Promise<AppointmentStatusLogEntry[]> {
        try {
            const res = await firstValueFrom(
                this.api.get<AppointmentStatusLogEntry[] | { data: AppointmentStatusLogEntry[] }>(
                    `appointments/${appointmentId}/estado-log`,
                ),
            );
            return unwrapList<AppointmentStatusLogEntry>(res.data);
        } catch {
            return [];
        }
    }

    async getPublicWeeklyAvailability(
        cuentaId: string,
        rol: 'psicologa' | 'docente',
        weekStart?: string,
    ): Promise<WeeklyAvailability | null> {
        const path = rol === 'psicologa'
            ? `psicologas/${cuentaId}/disponibilidad`
            : `docentes/${cuentaId}/disponibilidad`;
        const params = weekStart ? { weekStart } : undefined;
        try {
            const res = await firstValueFrom(
                this.api.get<WeeklyAvailability | { data: WeeklyAvailability }>(
                    path,
                    params,
                ),
            );
            return (res?.data ?? null) as WeeklyAvailability | null;
        } catch {
            return null;
        }
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

    async getFreeSlots(
        cuentaId: string,
        date: string,
        slotMinutes?: number,
    ): Promise<FreeSlot[]> {
        try {
            const params: Record<string, string> = { date };
            if (slotMinutes) params['slotMinutes'] = String(slotMinutes);
            const res = await firstValueFrom(
                this.api.get<FreeSlot[] | { data: FreeSlot[] }>(
                    `appointments/free-slots/${cuentaId}`,
                    params,
                ),
            );
            return unwrapList<FreeSlot>(res.data);
        } catch {
            return [];
        }
    }

    async getDayBlocks(
        cuentaId: string,
        date: string,
    ): Promise<DayBlocksResponse | null> {
        try {
            const res = await firstValueFrom(
                this.api.get<DayBlocksResponse | { data: DayBlocksResponse }>(
                    `appointments/day-blocks/${cuentaId}`,
                    { date } as Record<string, string>,
                ),
            );
            return (res?.data ?? null) as DayBlocksResponse | null;
        } catch {
            return null;
        }
    }

    async getFollowUpSuggestion(
        appointmentId: string,
    ): Promise<FollowUpSuggestion | null> {
        try {
            const res = await firstValueFrom(
                this.api.get<FollowUpSuggestion | { data: FollowUpSuggestion }>(
                    `appointments/${appointmentId}/seguimiento-sugerido`,
                ),
            );
            return (res?.data ?? null) as FollowUpSuggestion | null;
        } catch {
            return null;
        }
    }

    async closeSession(
        appointmentId: string,
        payload: CloseSessionPayload,
    ): Promise<CloseSessionResult> {
        const res = await firstValueFrom(
            this.api.post<CloseSessionResult>(
                `appointments/${appointmentId}/cerrar-sesion`,
                payload,
            ),
        );
        await this.loadMine({});
        return res.data;
    }

    // ════════════════════════════════════════════════════════════
    // DISPONIBILIDAD — WEEKLY (horario base)
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

    async getRulesForTarget(targetId: string): Promise<AppointmentRoleRule | null> {
        try {
            const res = await firstValueFrom(
                this.api.get<AppointmentRoleRule | { data: AppointmentRoleRule } | null>(
                    `appointments/rules/${targetId}`,
                ),
            );
            return (res?.data ?? null) as AppointmentRoleRule | null;
        } catch {
            return null;
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
    // DISPONIBILIDAD — OVERRIDES SPECIFIC (por fecha puntual)
    // ════════════════════════════════════════════════════════════

    async getOverridesForWeek(
        cuentaId: string,
        weekStart?: string,
    ): Promise<AvailabilityOverrideDay[]> {
        try {
            const params: Record<string, string> = {};
            if (weekStart) params['weekStart'] = weekStart;
            const res = await firstValueFrom(
                this.api.get<AvailabilityOverrideDay[] | { data: AvailabilityOverrideDay[] }>(
                    `appointments/availability/overrides/${cuentaId}`,
                    params,
                ),
            );
            return unwrapList<AvailabilityOverrideDay>(res.data);
        } catch {
            return [];
        }
    }

    async replaceOverridesForDate(
        cuentaId: string,
        date: string,
        slots: { horaInicio: string; horaFin: string }[],
    ): Promise<ReplaceOverridesResult> {
        const res = await firstValueFrom(
            this.api.put<ReplaceOverridesResult>(
                `appointments/availability/overrides/${cuentaId}/${date}`,
                { slots },
            ),
        );
        return res.data;
    }

    async deleteOverrideForDate(
        cuentaId: string,
        date: string,
    ): Promise<void> {
        await firstValueFrom(
            this.api.delete(
                `appointments/availability/overrides/${cuentaId}/${date}`,
            ),
        );
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
                    'appointments/teachers/bookable',
                ),
            );
            const list = unwrapList<DocenteSelectItem>(res.data).map((d) => ({
                ...d,
                foto_url: d.foto_url ?? null,
            }));
            this.docentes.set(list);
        } catch {
            this.docentes.set([]);
        } finally {
            this.loadingDocentes.set(false);
        }
    }

    async loadAdmins(): Promise<void> {
        if (this.loadingAdmins()) return;
        this.loadingAdmins.set(true);
        try {
            const res = await firstValueFrom(
                this.api.get<AdminSelectItem[] | { data: AdminSelectItem[] }>(
                    'appointments/admins/bookable',
                ),
            );
            this.admins.set(unwrapList<AdminSelectItem>(res.data));
        } catch {
            this.admins.set([]);
        } finally {
            this.loadingAdmins.set(false);
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
    // SEARCH
    // ════════════════════════════════════════════════════════════

    async searchMyStudents(query: string): Promise<StudentSearchResult[]> {
        const term = (query ?? '').trim();
        if (term.length < 2) return [];
        try {
            const res = await firstValueFrom(
                this.api.get<StudentSearchResult[] | { data: StudentSearchResult[] }>(
                    'psychology/directory/students/search',
                    { q: term },
                ),
            );
            return unwrapList<StudentSearchResult>(res.data);
        } catch {
            return [];
        }
    }

    async searchParents(query: string): Promise<ParentSearchResult[]> {
        const term = (query ?? '').trim();
        if (term.length < 2) return [];
        try {
            const res = await firstValueFrom(
                this.api.get<ParentSearchResult[] | { data: ParentSearchResult[] }>(
                    'psychology/directory/parents/search',
                    { q: term },
                ),
            );
            return unwrapList<ParentSearchResult>(res.data);
        } catch {
            return [];
        }
    }

    async getStudentParents(studentId: string): Promise<LinkedParent[]> {
        if (!studentId) return [];
        try {
            const res = await firstValueFrom(
                this.api.get<LinkedParent[] | { data: LinkedParent[] }>(
                    `psychology/directory/students/${studentId}/parents`,
                ),
            );
            return unwrapList<LinkedParent>(res.data);
        } catch {
            return [];
        }
    }

    async countFutureAppointments(): Promise<number> {
        try {
            const res = await firstValueFrom(
                this.api.get<{ count: number } | { data: { count: number } }>(
                    'appointments/count-future',
                ),
            );
            const data = (res?.data ?? res) as { count: number };
            return data?.count ?? 0;
        } catch {
            return 0;
        }
    }
}

// ── Tipos públicos del search ────────────────────────────────────
export interface StudentSearchResult {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    codigo_estudiante: string;
    foto_storage_key: string | null;
    inclusivo: boolean;
    grado: string | null;
    grado_id: string | null;
    seccion: string | null;
    seccion_id: string | null;
    padre: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
        relacion: string | null;
    } | null;
}

export interface ParentSearchResult {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    relacion: string | null;
    email: string | null;
    telefono: string | null;
    foto_storage_key?: string | null;
}

export interface LinkedParent {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    relacion: string | null;
    email: string | null;
    telefono: string | null;
}