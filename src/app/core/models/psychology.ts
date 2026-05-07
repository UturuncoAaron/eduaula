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
    parentId: string;
    studentId: string;
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
    student?: AssignedStudent;
    parent?: { id: string; nombre: string; apellido_paterno: string; apellido_materno: string | null };
}

export interface CreateAppointmentPayload {
    parentId: string;
    studentId: string;
    tipo: AppointmentTipo;
    modalidad: AppointmentModalidad;
    motivo: string;
    scheduledAt: string;
    durationMin?: number;
    priorNotes?: string;
}

export interface UpdateAppointmentPayload {
    estado?: AppointmentEstado;
    scheduledAt?: string;
    modalidad?: AppointmentModalidad;
    followUpNotes?: string;
    rescheduledFromId?: string;
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


