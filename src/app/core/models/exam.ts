export interface Exam {
    id: string;
    curso_id: string;
    curso?: { id: string; nombre: string } | string | null;
    titulo: string;
    instrucciones?: string | null;
    fecha_limite: string;
    puntos_max: number;
    permite_alternativas: boolean;
    activo: boolean;
    tipo?: 'tarea' | 'examen';
    bimestre?: number | null;
    semana?: number | null;
    preguntas?: Question[];
    created_at?: string;
}

export interface Question {
    id: string;
    tarea_id: string;
    enunciado: string;
    puntos: number;
    orden: number;
    opciones?: Option[];
}

export interface Option {
    id: string;
    pregunta_id: string;
    texto: string;
    es_correcta?: boolean;
    orden: number;
}

export interface Attempt {
    id: string;
    examen_id?: string;
    tarea_id?: string;
    alumno_id: string;
    alumno?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    puntaje?: number;
    calificacion_auto?: number;
    completado?: boolean;
}

export interface Answer {
    pregunta_id: string;
    opcion_id: string;
}
