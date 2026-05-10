// ═══════════════════════════════════════════════════════════════
// Modelos del módulo de citas y disponibilidad
// ═══════════════════════════════════════════════════════════════

export type AppointmentTipo =
    | 'academico' | 'conductual' | 'psicologico'
    | 'familiar' | 'disciplinario' | 'otro';

export type AppointmentModalidad = 'presencial';

export type AppointmentEstado =
    | 'pendiente' | 'confirmada' | 'realizada'
    | 'cancelada' | 'no_asistio';

export type DiaSemana =
    | 'lunes' | 'martes' | 'miercoles'
    | 'jueves' | 'viernes' | 'sabado';

// ── Cita ────────────────────────────────────────────────────────
export interface Appointment {
    id: string;
    createdById: string;
    convocadoAId: string;
    parentId: string | null;
    studentId: string | null;
    tipo: AppointmentTipo;
    modalidad: AppointmentModalidad;
    motivo: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
    priorNotes?: string | null;
    followUpNotes?: string | null;
    rescheduledFromId?: string | null;
    reminderSent: boolean;
    createdAt: string;
    updatedAt: string;
    student?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
    } | null;
    parent?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
    } | null;
    convocadoA?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno?: string | null;
        rol: string;
    } | null;
}

export interface CreateAppointmentPayload {
    convocadoAId: string;
    studentId?: string;
    parentId?: string;
    tipo: AppointmentTipo;
    motivo: string;
    scheduledAt: string;
    durationMin?: number;
    priorNotes?: string;
}

export interface UpdateAppointmentPayload {
    estado?: AppointmentEstado;
    scheduledAt?: string;
    durationMin?: number;
    followUpNotes?: string;
    rescheduledFromId?: string;
}

export interface CancelAppointmentPayload {
    motivo?: string;
}

export interface ListAppointmentsQuery {
    estado?: AppointmentEstado;
    from?: string;
    to?: string;
    studentId?: string;
    order?: 'DESC' | 'ASC';
    page?: number;
    limit?: number;
}

// ── Disponibilidad genérica (psicóloga, docente, etc.) ──────────
export interface AccountAvailability {
    id: string;
    cuentaId: string;
    diaSemana: DiaSemana;
    horaInicio: string; // 'HH:mm'
    horaFin: string;    // 'HH:mm'
    activo: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SetAvailabilityPayload {
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
}

// ── Slot ocupado (para pintar el calendario) ────────────────────
export interface SlotTaken {
    id: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
}