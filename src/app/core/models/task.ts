export interface Task {
    id: string;
    curso_id: string;
    curso?: string;
    titulo: string;
    instrucciones?: string;
    fecha_limite: string;
    puntos_max: number;
    activo: boolean;
    created_at?: string;
}

export interface SubmissionAlumno {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string | null;
    codigo_estudiante?: string;
}

export interface Submission {
    id: string;
    tarea_id: string;
    alumno_id: string;
    alumno?: SubmissionAlumno;
    storage_key?: string | null;
    nombre_archivo?: string | null;
    respuesta_texto?: string | null;
    calificacion_auto?: number | null;
    calificacion_manual?: number | null;
    calificacion_final?: number | null;
    comentario_docente?: string | null;
    con_retraso: boolean;
    fecha_entrega: string;
}
