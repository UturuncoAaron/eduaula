export interface Grade {
    id: string;
    alumno_id: string;
    alumno?: string;
    curso_id: string;
    curso?: string;
    periodo_id: number;
    bimestre: 1 | 2 | 3 | 4;
    nota_examenes?: number;
    nota_tareas?: number;
    nota_participacion?: number;
    nota_final?: number;
    escala?: 'AD' | 'A' | 'B' | 'C';
}