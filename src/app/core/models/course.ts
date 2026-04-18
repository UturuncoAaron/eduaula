export interface Course {
    id: string;
    nombre: string;
    descripcion?: string;
    docente_id: string;
    docente?: { nombre: string; apellido_paterno: string };
    seccion_id: number;
    seccion?: { nombre: string };
    periodo_id: number;
    activo: boolean;
}

export interface Material {
    id: string;
    curso_id: string;
    titulo: string;
    tipo: 'pdf' | 'video' | 'link' | 'grabacion' | 'otro';
    url: string;
    descripcion?: string;
    orden: number;
    created_at: string;
}