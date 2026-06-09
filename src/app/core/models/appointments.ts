export type AppointmentTipo =
    | 'academico' | 'conductual' | 'psicologico'
    | 'familiar' | 'disciplinario' | 'otro';

export type AppointmentModalidad = 'presencial' | 'virtual' | 'telefonico';

export type AppointmentEstado =
    | 'pendiente' | 'confirmada' | 'realizada'
    | 'cancelada' | 'rechazada' | 'no_asistio';

export type AppointmentStatus = AppointmentEstado;

export type RoleWithAvailability = 'psicologa' | 'docente' | 'admin';

export const ROLES_WITH_AVAILABILITY: readonly RoleWithAvailability[] = [
    'psicologa', 'docente', 'admin', 
] as const;

export function hasAvailability(rol: string | undefined): boolean {
    return !!rol && (ROLES_WITH_AVAILABILITY as readonly string[]).includes(rol);
}

export type DiaSemana =
    | 'lunes' | 'martes' | 'miercoles'
    | 'jueves' | 'viernes' | 'sabado';

export type AppointmentRole =
    | 'psicologa' | 'docente' | 'admin' | 'staff' | 'padre';

export interface AppointmentRoleRule {
    role: AppointmentRole;
    fixedDurationMin: number | null;
    maxDurationMin: number;
    slotMinutes: number;
    /**
     * Tamaño del bloque que se muestra en el editor de disponibilidad (grilla).
     * Para docente = 45 min (bloque con 3 sub-slots de 15 min).
     * Para admin/director = 15 min (slot indivisible).
     * Para psicóloga = 30 min.
     */
    availabilityBlockMin: number;
    maxConsecutiveSlots: number;
    allowedDays: readonly string[];
    defaultHours: { start: string; end: string };
    /** Hora límite de atención (HH:mm). null = solo aplica defaultHours. */
    attentionEnd?: string | null;
    directBooking: boolean;
    label: string;
}

export const MAX_CONSECUTIVE_SLOTS = 2;

const WEEK_FULL: readonly string[] = [
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes',
] as const;

export const APPOINTMENT_RULES: Record<AppointmentRole, AppointmentRoleRule> = {
    psicologa: {
        role: 'psicologa',
        fixedDurationMin: null,
        maxDurationMin: 60,
        slotMinutes: 30,
        // La psicóloga publica bloques de 30 min en su disponibilidad.
        availabilityBlockMin: 30,
        maxConsecutiveSlots: MAX_CONSECUTIVE_SLOTS,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '16:00' },
        directBooking: true,
        label: 'Psicología',
    },
    docente: {
        role: 'docente',
        // Spec (Aarón, 2026-05): el docente publica bloques de 45 min en su
        // disponibilidad. El motor los divide internamente en 3 sub-slots de
        // 15 min, permitiendo hasta 3 padres por bloque. Cada cita = 15 min.
        fixedDurationMin: 15,
        maxDurationMin: 15,
        slotMinutes: 15,
        availabilityBlockMin: 45,
        maxConsecutiveSlots: 1,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        attentionEnd: '15:30',
        directBooking: false,
        label: 'Docente',
    },
    admin: {
        role: 'admin',
        // El admin publica slots de 15 min fijos e indivisibles (1 padre/slot).
        fixedDurationMin: 15,
        maxDurationMin: 15,
        slotMinutes: 15,
        availabilityBlockMin: 15,
        maxConsecutiveSlots: 1,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        attentionEnd: '15:30',
        directBooking: false,
        label: 'Administrador',
    },
    staff: {
        role: 'staff',
        fixedDurationMin: 15,
        maxDurationMin: 15,
        slotMinutes: 15,
        availabilityBlockMin: 15,
        maxConsecutiveSlots: 1,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Staff',
    },
    padre: {
        role: 'padre',
        fixedDurationMin: null,
        maxDurationMin: 60,
        slotMinutes: 30,
        availabilityBlockMin: 30,
        maxConsecutiveSlots: MAX_CONSECUTIVE_SLOTS,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '16:00' },
        directBooking: false,
        label: 'Padre / Tutor',
    },
};

export function ruleForRol(rol: string): AppointmentRoleRule | null {
    if (rol === 'admin') return APPOINTMENT_RULES.admin;
    if (rol === 'psicologa') return APPOINTMENT_RULES.psicologa;
    if (rol === 'docente') return APPOINTMENT_RULES.docente;
    if (rol === 'staff') return APPOINTMENT_RULES.staff;
    if (rol === 'padre') return APPOINTMENT_RULES.padre;
    return null;
}

export function hmToMinutes(hm: string): number {
    const [h, m] = hm.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

export function ruleToStartHour(rule: AppointmentRoleRule): number {
    return Math.floor(hmToMinutes(rule.defaultHours.start) / 60);
}

export function ruleToEndHour(rule: AppointmentRoleRule): number {
    const totalMin = hmToMinutes(rule.defaultHours.end);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? h + 1 : h;
}

export function ruleToSlotMinutes(rule: AppointmentRoleRule, fallback = 30): number {
    return rule.fixedDurationMin ?? fallback;
}

export function ruleToMaxConsecutiveSlots(rule: AppointmentRoleRule): number {
    if (rule.fixedDurationMin !== null) return 1;
    const byMin = Math.floor(rule.maxDurationMin / rule.slotMinutes);
    return Math.min(rule.maxConsecutiveSlots, byMin);
}

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
    student?: PersonRef | null;
    parent?: PersonRef | null;
    convocadoA?: PersonRefWithRole | null;
    convocadoPor?: PersonRefWithRole | null;
}

interface PersonRef {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
}

interface PersonRefWithRole extends PersonRef {
    rol: string;
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

export type AvailabilityTipo = 'weekly';

export interface AccountAvailability {
    id: string;
    cuentaId: string;
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
    activo: boolean;
    /** Horario base recurrente. */
    tipo: AvailabilityTipo;
    /** Reservado para compatibilidad con registros antiguos; el flujo actual usa null. */
    fechaEspecifica: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SetAvailabilityPayload {
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
}

// ── Disponibilidad semanal con citas y seguimientos ───────────────────
export interface WeekAppointmentSummary {
    id: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
    motivo: string;
    isFollowUp: boolean;
    studentName: string | null;
}

export interface SlotTaken {
    id: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
}

export interface FreeSlot {
    start: string;
    end: string;
    available: boolean;
}

export interface PostponeAppointmentPayload {
    motivo: string;
    nuevaFechaHora: string;
}

export interface DeriveAppointmentPayload {
    alumnoId: string;
    psicologaId: string;
    motivo: string;
    scheduledAt: string;
    durationMin?: number;
}

export interface CompleteAppointmentPayload {
    notasPosteriores?: string;
}

export interface AvailableParent {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
}

export interface CreateAppointmentResult extends Appointment {
    availableParents?: AvailableParent[];
}

export interface WeeklyAvailabilitySlot {
    start: string;
    end: string;
    available: boolean;
}

export interface WeeklyAvailabilityDay {
    date: string;
    diaSemana: DiaSemana;
    diaLabel: string;
    slots: WeeklyAvailabilitySlot[];
}

export interface WeeklyAvailability {
    cuentaId: string;
    weekStart: string;
    slotMinutes: number;
    days: WeeklyAvailabilityDay[];
}

export interface AffectedAppointment {
    id: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
    motivo: string;
    convocadoPor: { id: string; nombre: string; apellido_paterno: string } | null;
    convocadoA: { id: string; nombre: string; apellido_paterno: string } | null;
    student: { id: string; nombre: string; apellido_paterno: string } | null;
}

export interface SlotConflictResponse {
    statusCode: 409;
    message: string;
    affectedCount: number;
    affected: AffectedAppointment[];
}

export interface AppointmentStatusLogEntry {
    id: string;
    appointmentId: string;
    previousStatus: AppointmentEstado | null;
    nextStatus: AppointmentEstado;
    changedAt: string;
    reason: string | null;
    changedBy: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        rol: string;
    } | null;
}

// ── Sub-slots / Drawer (bloques de disponibilidad de un día) ─────────
export interface DaySubSlot {
    start: string;
    end: string;
    available: boolean;
    appointmentId: string | null;
    occupantLabel: string | null;
}

export interface DayBlock {
    start: string;
    end: string;
    total: number;
    freeCount: number;
    subSlots: DaySubSlot[];
}

export interface DayBlocksResponse {
    cuentaId: string;
    rol: string;
    role: AppointmentRole | null;
    date: string;
    diaSemana: DiaSemana | null;
    slotMinutes: number;
    fixedDurationMin: number | null;
    maxConsecutiveSlots: number;
    attentionEnd: string | null;
    blocks: DayBlock[];
}

// ── Cierre clínico + Plan de Seguimiento Inteligente ─────────────────
export interface FollowUpSuggestion {
    appointmentId: string;
    psychologistId: string;
    studentId: string;
    tipo: AppointmentTipo;
    /** Intervalo de recurrencia (días) según el tipo de cita. */
    intervalDays: number;
    /** Fecha recomendada (YYYY-MM-DD). */
    suggestedDate: string;
    slotMinutes: number;
    maxConsecutiveSlots: number;
    defaultDurationMin: number;
    slots: FreeSlot[];
    parents: AvailableParent[];
}

export interface CloseSessionFollowUp {
    scheduledAt: string;
    durationMin?: number;
    incluirPadre?: boolean;
    parentId?: string;
    tipo?: AppointmentTipo;
    motivo?: string;
}

export type FichaCategoria =
    | 'conductual' | 'academico' | 'familiar' | 'emocional' | 'otro';

export interface CloseSessionPayload {
    notasClinicas?: string;
    fichaCategoria?: FichaCategoria;
    notasPosteriores?: string;
    seguimiento?: CloseSessionFollowUp;
}

export interface CloseSessionResult {
    closed: Appointment;
    followUp: Appointment | null;
}