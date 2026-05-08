// ═══════════════════════════════════════════════════════════════
// Modelos del módulo de psicología (alineados con DTOs del backend)
// ═══════════════════════════════════════════════════════════════

export type RecordCategoria =
    | 'conductual' | 'academico' | 'familiar' | 'emocional' | 'otro';

export type AppointmentTipo =
    | 'academico' | 'conductual' | 'psicologico' | 'familiar' | 'otro';

export type AppointmentModalidad = 'presencial' | 'virtual' | 'telefonico';

export type AppointmentEstado =
    | 'pendiente' | 'confirmada' | 'realizada' | 'cancelada' | 'no_asistio';

export type WeekDay = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';
export interface CancelAppointmentPayload {
  motivo: string;
}

// ── Alumno mínimo (vista del psicólogo) ─────────────────────────────────────
export interface AssignedStudent {
    id: string;
    codigo_estudiante: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    fecha_nacimiento?: string | null;
    email?: string | null;
    telefono?: string | null;
}

// Cada elemento de getMyStudents() — relación PsychologistStudent
export interface PsychologistStudentAssignment {
    psychologistId: string;
    studentId: string;
    activo: boolean;
    desde: string;
    hasta: string | null;
    student: AssignedStudent;
}

// ── Padre vinculado a un alumno ─────────────────────────────────────────────
export interface ParentOfStudent {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    relacion: 'padre' | 'madre' | 'tutor' | 'apoderado';
    email: string | null;
    telefono: string | null;
    codigo_acceso: string | null;
}

// ── Padre buscable (directorio independiente) ───────────────────────────────
export interface SearchableParent {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    relacion?: string | null;
}

// ── Ficha psicológica ───────────────────────────────────────────────────────
export interface PsychologyRecord {
    id: string;
    psychologistId: string;
    studentId: string;
    categoria: RecordCategoria;
    contenido: string;
    isPrivate: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateRecordPayload {
    studentId: string;
    categoria: RecordCategoria;
    contenido: string;
}

export interface UpdateRecordPayload {
    categoria?: RecordCategoria;
    contenido?: string;
}

// ── Cita ────────────────────────────────────────────────────────────────────
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
    meetingLink?: string | null;
    reminderSent: boolean;
    createdAt: string;
    updatedAt: string;
    student?: AssignedStudent;
    parent?: { id: string; nombre: string; apellido_paterno: string; apellido_materno: string | null } | null;
    convocadoA?: { id: string; nombre: string; apellido_paterno: string; apellido_materno?: string | null; rol: string } | null;
}

/**
 * Coincide 1:1 con `CreateAppointmentDto` del backend.
 * - `convocadoAId`: a quién va dirigida la cita (psicóloga/docente/admin/padre/auxiliar).
 * - `parentId`: padre involucrado (opcional). El backend valida que pertenezca al alumno.
 * - `modalidad`: opcional; si se omite el backend pone `presencial`.
 */
export interface CreateAppointmentPayload {
    convocadoAId: string;
    studentId?: string;
    parentId?: string;
    tipo: AppointmentTipo;
    modalidad?: AppointmentModalidad;
    motivo: string;
    scheduledAt: string;
    durationMin?: number;
    priorNotes?: string;
    meetingLink?: string;
}

export interface UpdateAppointmentPayload {
    estado?: AppointmentEstado;
    scheduledAt?: string;
    modalidad?: AppointmentModalidad;
    followUpNotes?: string;
    rescheduledFromId?: string;
    meetingLink?: string;
}

// ── Disponibilidad ──────────────────────────────────────────────────────────
export interface PsychologistAvailability {
    id: string;
    psychologistId: string;
    weekDay: WeekDay;
    startTime: string; // 'HH:mm:ss'
    endTime: string;
    activo: boolean;
}

export interface CreateAvailabilityPayload {
    weekDay: WeekDay;
    startTime: string;
    endTime: string;
}

// ── Bloqueos ────────────────────────────────────────────────────────────────
export interface PsychologistBlock {
    id: string;
    psychologistId: string;
    startDate: string; // ISO
    endDate: string;
    motivo: string | null;
    createdAt: string;
}

export interface CreateBlockPayload {
    startDate: string;
    endDate: string;
    motivo?: string;
}

// ── Directorio público de psicólogas ────────────────────────────────────────
// Lo consumen padre/alumno para elegir a quién agendar.
export interface Psicologa {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    especialidad: string | null;
    email: string | null;
    telefono: string | null;
    foto_storage_key: string | null;
}

/** Slot disponible devuelto por GET /psychology/slots/:psychologistId */
export type AvailableSlot = string; // ISO timestamp


