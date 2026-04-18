export interface Task {
    id: string;
    curso_id: string;
    curso?: string;
    titulo: string;
    descripcion?: string;
    fecha_entrega: string;
    puntos_max: number;
    activo: boolean;
    created_at?: string;
}

export interface Submission {
    id: string;
    tarea_id: string;
    alumno_id: string;
    alumno?: string;
    url_archivo?: string;
    respuesta_texto?: string;
    fecha_entrega: string;
    calificacion?: number;
    comentario?: string;
    con_retraso: boolean;
}