// ═══════════════════════════════════════════════════════════════
// core/models/psychology.ts
// ═══════════════════════════════════════════════════════════════

export type RecordCategoria =
    | 'conductual' | 'academico' | 'familiar' | 'emocional' | 'otro';

// ── Alumno mínimo ─────────────────────────────────────────────
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

// ── Padre ─────────────────────────────────────────────────────
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

// ── Ficha de texto (anotación clínica) ───────────────────────
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
    citaId?: string;
}

export interface UpdateRecordPayload {
    categoria?: RecordCategoria;
    contenido?: string;
}

// ── Psicólogas / Docentes ─────────────────────────────────────
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

export interface Docente {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    especialidad: string | null;
    foto_url: string | null;
    tutoria_actual?: { seccion_id: string; seccion_label: string } | null;
}

// ── Informes psicológicos ─────────────────────────────────────
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
    citaId?: string;
}

export type UpdateInformePayload = Partial<Omit<CreateInformePayload, 'studentId'>>;

export const INFORME_TIPO_LABELS: Record<InformeTipo, string> = {
    evaluacion: 'Evaluación psicológica',
    seguimiento: 'Reporte de seguimiento',
    derivacion_familia: 'Derivación a la familia',
    derivacion_externa: 'Derivación a especialista externo',
};

// ── Archivos subidos (fichas, tests, informes externos) ───────
// 'ficha'   → documentos externos (anamnesis, derivaciones, etc.)
// 'test'    → resultados de pruebas estandarizadas
// 'informe' → informes externos subidos (no generados en el sistema)
export type ArchivoCategoria = 'ficha' | 'test' | 'informe';

export interface ArchivoPsicologico {
    id: string;
    psychologistId: string;
    studentId: string;
    categoria: ArchivoCategoria;
    nombre: string;
    descripcion: string | null;
    confidencial: boolean;
    storageKey: string;
    nombreOriginal: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    citaId?: string | null;
    createdAt: string;
}

export interface UploadArchivoPayload {
    studentId: string;
    categoria: ArchivoCategoria;
    nombre: string;
    descripcion?: string;
    confidencial: boolean;
    file: File;
    citaId?: string;
}

export const ARCHIVO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB