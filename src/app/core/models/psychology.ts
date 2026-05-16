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

// ── Informes psicológicos ──────────────────────────────────────────
// Documentos formales que la psicóloga emite sobre un alumno. Pueden
// derivarse a la familia o a un especialista externo. Una vez
// "finalizado" queda inmutable y se imprime/guarda como PDF desde el
// navegador (no requiere lib backend de PDF — usamos `window.print()`
// sobre una vista con `@media print` afinado).
export type InformeTipo =
    | 'evaluacion'
    | 'seguimiento'
    | 'derivacion_familia'
    | 'derivacion_externa';

export type InformeEstado = 'borrador' | 'finalizado';

export interface InformePsicologico {
    id: string;
    psychologistId: string;
    studentId: string;
    tipo: InformeTipo;
    titulo: string;
    motivo: string;
    antecedentes: string | null;
    observaciones: string;
    recomendaciones: string | null;
    derivadoA: string | null;
    estado: InformeEstado;
    confidencial: boolean;
    finalizadoAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateInformePayload {
    studentId: string;
    tipo: InformeTipo;
    titulo: string;
    motivo: string;
    antecedentes?: string | null;
    observaciones: string;
    recomendaciones?: string | null;
    derivadoA?: string | null;
    confidencial?: boolean;
}

export type UpdateInformePayload = Partial<Omit<CreateInformePayload, 'studentId'>>;

export const INFORME_TIPO_LABELS: Record<InformeTipo, string> = {
    evaluacion: 'Evaluación psicológica',
    seguimiento: 'Reporte de seguimiento',
    derivacion_familia: 'Derivación a la familia',
    derivacion_externa: 'Derivación a especialista externo',
};
