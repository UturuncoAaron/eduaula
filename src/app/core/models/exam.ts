export interface Exam {
    id: string;
    curso_id: string;
    curso?: string;
    titulo: string;
    descripcion?: string;
    fecha_inicio: string;
    fecha_fin: string;
    puntos_total: number;
    activo: boolean;
    created_at?: string;
}

export interface Question {
    id: string;
    examen_id: string;
    enunciado: string;
    tipo: 'multiple' | 'verdadero_falso';
    puntos: number;
    orden: number;
    opciones?: Option[];
}

export interface Option {
    id: string;
    pregunta_id: string;
    texto: string;
    es_correcta: boolean;
    orden: number;
}

export interface Attempt {
    id: string;
    examen_id: string;
    alumno_id: string;
    alumno?: string;
    fecha_inicio: string;
    fecha_fin?: string;
    puntaje?: number;
    completado: boolean;
}

export interface Answer {
    pregunta_id: string;
    opcion_id: string;
}