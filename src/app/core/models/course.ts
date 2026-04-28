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

export type TipoMaterial = 'pdf' | 'video' | 'link' | 'grabacion' | 'otro';

export interface Material {
    id: string;
    curso_id: string;
    titulo: string;
    tipo: TipoMaterial;
    url: string;
    storage_key?: string | null;
    nombre_original?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
    descripcion?: string | null;
    bimestre?: number | null;
    semana?: number | null;
    orden: number;
    activo?: boolean;
    created_at: string;
    updated_at?: string;
}

export interface MaterialDownload {
    url: string;
    filename: string;
    kind: 'file' | 'link';
}

export interface MaterialPreviewInfo {
    url: string;
    filename: string;
    mime_type: string | null;
    kind: 'file' | 'link';
}
