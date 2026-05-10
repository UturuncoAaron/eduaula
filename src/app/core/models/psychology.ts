// ═══════════════════════════════════════════════════════════════
// Modelos del módulo de psicología
// ═══════════════════════════════════════════════════════════════

export type RecordCategoria =
    | 'conductual' | 'academico' | 'familiar' | 'emocional' | 'otro';

// ── Alumno mínimo (vista del psicólogo) ─────────────────────────
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

export interface PsychologistStudentAssignment {
    psychologistId: string;
    studentId: string;
    activo: boolean;
    desde: string;
    hasta: string | null;
    student: AssignedStudent;
}

// ── Padre vinculado a un alumno ─────────────────────────────────
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

export interface SearchableParent {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    relacion?: string | null;
}

// ── Ficha psicológica ───────────────────────────────────────────
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

// ── Directorio público de psicólogas ────────────────────────────
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
// Si ya tienes `Psicologa`, agrega `Docente` con la misma forma.
export interface Docente {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    especialidad: string | null;
    foto_url: string | null;
    tutoria_actual?: {
        seccion_id: string;
        seccion_label: string;
    } | null;
}