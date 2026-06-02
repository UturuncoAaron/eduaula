// core/models/psychology.ts

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
export type InformeEstado = 'borrador' | 'finalizado';

export interface InformePsicologico {
    id: string;
    psychologistId: string;
    studentId: string;
    // Datos de filiación
    edadEvaluacion: number | null;
    motivoConsultaCorto: string | null;
    referente: string | null;
    fechaEvaluacionInicio: string | null;
    fechaEvaluacionFin: string | null;
    fechaInforme: string | null;
    tecnicasUtilizadas: string | null;
    instrumentosUtilizados: string | null;
    // Cuerpo
    motivoConsulta: string | null;
    antecedentesFamilia: string | null;
    antecedentesAcademico: string | null;
    antecedentesEscolar: string | null;
    antecedentesAutopercepcion: string | null;
    observacionesConducta: string | null;
    resultadosCognitiva: string | null;
    resultadosEmocional: string | null;
    resultadosConductual: string | null;
    resultadosSocial: string | null;
    analisisResultados: string | null;
    conclusiones: string | null;
    recomendacionesInstitucion: string | null;
    recomendacionesFamilia: string | null;
    // Control
    estado: InformeEstado;
    confidencial: boolean;
    citaId: string | null;
    finalizadoAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateInformePayload {
    studentId: string;
    edadEvaluacion?: number | null;
    motivoConsultaCorto?: string | null;
    referente?: string | null;
    fechaEvaluacionInicio?: string | null;
    fechaEvaluacionFin?: string | null;
    fechaInforme?: string | null;
    tecnicasUtilizadas?: string | null;
    instrumentosUtilizados?: string | null;
    motivoConsulta?: string | null;
    antecedentesFamilia?: string | null;
    antecedentesAcademico?: string | null;
    antecedentesEscolar?: string | null;
    antecedentesAutopercepcion?: string | null;
    observacionesConducta?: string | null;
    resultadosCognitiva?: string | null;
    resultadosEmocional?: string | null;
    resultadosConductual?: string | null;
    resultadosSocial?: string | null;
    analisisResultados?: string | null;
    conclusiones?: string | null;
    recomendacionesInstitucion?: string | null;
    recomendacionesFamilia?: string | null;
    confidencial?: boolean;
    citaId?: string;
}

export type UpdateInformePayload = Partial<Omit<CreateInformePayload, 'studentId'>>;

// ── Archivos subidos (fichas, tests, informes externos) ───────
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

export const ARCHIVO_MAX_BYTES = 10 * 1024 * 1024;