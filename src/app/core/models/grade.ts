export interface Grade {
    id: string;
    alumno_id: string;
    alumno?: string;
    curso_id: string;
    curso?: string;
    periodo_id: number;
    bimestre: 1 | 2 | 3 | 4;
    nota_tareas?: number | null;
    nota_participacion?: number | null;
    nota_final?: number | null;
    escala?: 'AD' | 'A' | 'B' | 'C' | null;
    observaciones?: string | null;
}

export interface GradeSummary {
    curso_id: string;
    curso_nombre: string;
    total_alumnos: number;
    registrados: number;
}