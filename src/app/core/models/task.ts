export type TaskTipo = 'tarea' | 'examen';
export type TaskKind = 'archivo' | 'interactiva';
export type EstadoTarea = 'pendiente' | 'vencida' | 'entregada' | 'calificada';
 
export interface Task {
    id: string;
    curso_id: string;
    curso?: string;
    titulo: string;
    tipo?: TaskTipo;
    instrucciones?: string | null;
    enunciado_storage_key?: string | null;
    enunciado_url?: string | null;
    fecha_limite: string;
    bimestre?: number | null;
    semana?: number | null;
    puntos_max: number;
    permite_alternativas?: boolean;
    permite_archivo?: boolean;
    permite_texto?: boolean;
    activo: boolean;
    preguntas?: Pregunta[];
    vencida?: boolean;
    created_at?: string;
}
 
export interface Pregunta {
    id: string;
    tarea_id: string;
    enunciado: string;
    puntos: number;
    orden: number;
    opciones?: Opcion[];
}
 
export interface Opcion {
    id: string;
    pregunta_id: string;
    texto: string;
    es_correcta?: boolean;
    orden: number;
}
 
export interface RespuestaAlternativa {
    id?: string;
    entrega_id?: string;
    pregunta_id: string;
    opcion_id: string;
    pregunta?: Pregunta;
    opcion?: Opcion;
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
    respuestas?: RespuestaAlternativa[];
    calificacion_auto?: number | null;
    calificacion_manual?: number | null;
    calificacion_final?: number | null;
    comentario_docente?: string | null;
    con_retraso: boolean;
    fecha_entrega: string;
}
 
export function tipoEntregaTarea(t: Task): TaskKind {
    return t.permite_alternativas ? 'interactiva' : 'archivo';
}
 
export function estadoAlumno(t: Task, s: Submission | null | undefined): EstadoTarea {
    if (s) return s.calificacion_final != null ? 'calificada' : 'entregada';
    return new Date(t.fecha_limite) > new Date() ? 'pendiente' : 'vencida';
}