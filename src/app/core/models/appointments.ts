// ═══════════════════════════════════════════════════════════════
// Modelos del módulo de citas y disponibilidad
// ═══════════════════════════════════════════════════════════════

export type AppointmentTipo =
    | 'academico' | 'conductual' | 'psicologico'
    | 'familiar' | 'disciplinario' | 'otro';

export type AppointmentModalidad = 'presencial' | 'virtual' | 'telefonico';

export type AppointmentEstado =
    | 'pendiente' | 'confirmada' | 'realizada'
    | 'cancelada' | 'rechazada' | 'no_asistio';

// Roles que tienen disponibilidad propia y pueden citar a otros
// (debe mantenerse sincronizado con ROLES_WITH_AVAILABILITY del backend).
export type RoleWithAvailability =
    | 'psicologa' | 'docente' | 'admin' | 'auxiliar';

export const ROLES_WITH_AVAILABILITY: readonly RoleWithAvailability[] = [
    'psicologa', 'docente', 'admin', 'auxiliar',
] as const;

export function hasAvailability(rol: string | undefined): boolean {
    return !!rol && (ROLES_WITH_AVAILABILITY as readonly string[]).includes(rol);
}

// Alias para compatibilidad con componentes que usan AppointmentStatus
export type AppointmentStatus = AppointmentEstado;

export type DiaSemana =
    | 'lunes' | 'martes' | 'miercoles'
    | 'jueves' | 'viernes' | 'sabado';

// ── Reglas por rol (mirror del BE) ─────────────────────────────
// El BE las sirve por GET /appointments/rules/:targetId.
// Las usamos para configurar el dialog (duración fija, días permitidos,
// horario por defecto si el profesional aún no configuró su agenda).
export type AppointmentRole =
    | 'psicologa' | 'docente' | 'director'
    | 'admin' | 'auxiliar' | 'padre';

export interface AppointmentRoleRule {
    role: AppointmentRole;
    fixedDurationMin: number | null;
    maxDurationMin: number;
    allowedDays: readonly string[];        // ['lunes','martes',...]
    defaultHours: { start: string; end: string };  // 'HH:MM'
    directBooking: boolean;
    label: string;
}

// ── Reglas locales (mirror del BE) ─────────────────────────────
// Permiten configurar el dialog sin pedir GET /appointments/rules cuando
// el caller ya conoce el rol (p.ej. el dialog del docente sabe que es él
// mismo). Mantener sincronizado con backend `appointments.rules.ts`.
const WEEK_FULL: readonly string[] = [
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes',
] as const;

export const APPOINTMENT_RULES: Record<AppointmentRole, AppointmentRoleRule> = {
    psicologa: {
        role: 'psicologa',
        fixedDurationMin: 30,
        maxDurationMin: 30,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '16:00' },
        directBooking: true,
        label: 'Psicología',
    },
    docente: {
        role: 'docente',
        fixedDurationMin: 45,
        maxDurationMin: 45,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Docente',
    },
    director: {
        role: 'director',
        fixedDurationMin: 15,
        maxDurationMin: 15,
        allowedDays: ['martes', 'jueves'],
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Dirección',
    },
    admin: {
        role: 'admin',
        fixedDurationMin: null,
        maxDurationMin: 60,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Administración',
    },
    auxiliar: {
        role: 'auxiliar',
        fixedDurationMin: null,
        maxDurationMin: 60,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Auxiliar',
    },
    padre: {
        role: 'padre',
        fixedDurationMin: null,
        maxDurationMin: 60,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '16:00' },
        directBooking: false,
        label: 'Padre / Tutor',
    },
};

/** True si el `cargo` corresponde a Dirección (Director/Directora/etc). */
export function isDirectorCargo(cargo: string | null | undefined): boolean {
    if (!cargo) return false;
    return /director/i.test(cargo);
}

/**
 * Devuelve la regla aplicable según rol+cargo del usuario actual.
 * Admin con cargo=director → regla de director (15min, mar/jue).
 * Roles fuera del flujo (alumno y otros) devuelven `null`.
 */
export function ruleForRol(
    rol: string,
    cargo?: string | null,
): AppointmentRoleRule | null {
    if (rol === 'admin') {
        return isDirectorCargo(cargo)
            ? APPOINTMENT_RULES.director
            : APPOINTMENT_RULES.admin;
    }
    if (rol === 'psicologa') return APPOINTMENT_RULES.psicologa;
    if (rol === 'docente') return APPOINTMENT_RULES.docente;
    if (rol === 'auxiliar') return APPOINTMENT_RULES.auxiliar;
    if (rol === 'padre') return APPOINTMENT_RULES.padre;
    return null;
}

/**
 * Hora 'HH:MM' → minutos desde 00:00.
 */
export function hmToMinutes(hm: string): number {
    const [h, m] = hm.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Hora inicial en horas enteras (floor) para usar en el calendario.
 * Ej.: '08:30' → 8.
 */
export function ruleToStartHour(rule: AppointmentRoleRule): number {
    return Math.floor(hmToMinutes(rule.defaultHours.start) / 60);
}

/**
 * Hora final en horas enteras (ceil al siguiente entero si termina en :30/:45)
 * para que la última fila visible cubra todo el rango.
 * Ej.: '15:30' → 16, '16:00' → 16, '14:45' → 15.
 */
export function ruleToEndHour(rule: AppointmentRoleRule): number {
    const totalMin = hmToMinutes(rule.defaultHours.end);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? h + 1 : h;
}

/**
 * Tamaño de slot en minutos cuando la regla lo fija (psicóloga=30,
 * docente=45, director=15); si la regla no es fija (admin/auxiliar)
 * devuelve `fallback`.
 */
export function ruleToSlotMinutes(
    rule: AppointmentRoleRule,
    fallback = 30,
): number {
    return rule.fixedDurationMin ?? fallback;
}

// ── Cita ────────────────────────────────────────────────────────
export interface Appointment {
    id: string;
    createdById: string;
    convocadoAId: string | null;
    parentId: string | null;
    studentId: string;
    tipo: AppointmentTipo;
    modalidad: AppointmentModalidad;
    motivo: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
    priorNotes: string | null;
    followUpNotes: string | null;
    rescheduledFromId: string | null;
    reminderSent: boolean;
    cancelledAt: string | null;
    cancelledById: string | null;
    cancelReason: string | null;
    createdAt: string;
    updatedAt: string;
    // Joins opcionales enriquecidos por el backend
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
        apellido_materno: string | null;
        rol: string;
    } | null;
    convocadoPor?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
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
    modalidad?: AppointmentModalidad;
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
    horaInicio: string;
    horaFin: string;
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