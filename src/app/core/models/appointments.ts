export type AppointmentTipo =
    | 'academico' | 'conductual' | 'psicologico'
    | 'familiar' | 'disciplinario' | 'otro';

export type AppointmentModalidad = 'presencial' | 'virtual' | 'telefonico';

export type AppointmentEstado =
    | 'pendiente' | 'confirmada' | 'realizada'
    | 'cancelada' | 'rechazada' | 'no_asistio';

export type AppointmentStatus = AppointmentEstado;

export type RoleWithAvailability = 'psicologa' | 'docente' | 'admin' | 'auxiliar';

export const ROLES_WITH_AVAILABILITY: readonly RoleWithAvailability[] = [
    'psicologa', 'docente', 'admin', 'auxiliar',
] as const;

export function hasAvailability(rol: string | undefined): boolean {
    return !!rol && (ROLES_WITH_AVAILABILITY as readonly string[]).includes(rol);
}

export type DiaSemana =
    | 'lunes' | 'martes' | 'miercoles'
    | 'jueves' | 'viernes' | 'sabado';

export type AppointmentRole =
    | 'psicologa' | 'docente' | 'admin' | 'auxiliar' | 'padre';

export interface AppointmentRoleRule {
    role: AppointmentRole;
    fixedDurationMin: number | null;
    maxDurationMin: number;
    slotMinutes: number;
    maxConsecutiveSlots: number;
    allowedDays: readonly string[];
    defaultHours: { start: string; end: string };
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
        maxConsecutiveSlots: MAX_CONSECUTIVE_SLOTS,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '16:00' },
        directBooking: true,
        label: 'Psicología',
    },
    docente: {
        role: 'docente',
        fixedDurationMin: 45,
        maxDurationMin: 45,
        slotMinutes: 45,
        maxConsecutiveSlots: 1,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Docente',
    },
    admin: {
        role: 'admin',
        fixedDurationMin: 15,
        maxDurationMin: 15,
        slotMinutes: 15,
        maxConsecutiveSlots: 1,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Administrador',
    },
    auxiliar: {
        role: 'auxiliar',
        fixedDurationMin: 15,
        maxDurationMin: 15,
        slotMinutes: 15,
        maxConsecutiveSlots: 1,
        allowedDays: WEEK_FULL,
        defaultHours: { start: '08:00', end: '15:30' },
        directBooking: false,
        label: 'Auxiliar',
    },
    padre: {
        role: 'padre',
        fixedDurationMin: null,
        maxDurationMin: 60,
        slotMinutes: 30,
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
    if (rol === 'auxiliar') return APPOINTMENT_RULES.auxiliar;
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