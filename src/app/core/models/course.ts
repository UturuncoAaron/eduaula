export interface CourseCatalog {
    id: string;
    nombre: string;
    area?: string | null;
    color: string;
    activo: boolean;
}

export interface CourseDocente {
    id?: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string | null;
    email?: string | null;
    telefono?: string | null;
    especialidad?: string | null;
    titulo_profesional?: string | null;
    foto_storage_key?: string | null;
}

export interface Course {
    id: string;
    nombre: string;
    descripcion?: string;
    catalogo_id: string;
    catalogo?: CourseCatalog | null;
    docente_id: string | null;
    docente?: CourseDocente | null;
    seccion_id: string;
    seccion?: { nombre: string };
    anio: number;
    color: string;
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
    oculto?: boolean;
    visto?: boolean;
    created_at: string;
    updated_at?: string;
}

export interface SemanaResumen {
    semana: number;
    bimestre: number;
    oculta: boolean;
    descripcion: string | null;
    config_id: string | null;
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

export interface CourseProgressEntry {
    semana: number | null;
    bimestre: number | null;
    total: number;
    completados: number;
}

export interface LiveClass {
    id: string;
    curso_id: string;
    curso?: { id: string; nombre: string } | null;
    titulo: string;
    descripcion?: string | null;
    fecha_hora: string;
    duracion_min: number;
    link_reunion: string;
    estado: 'programada' | 'activa' | 'finalizada' | 'cancelada';
    created_at?: string;
    updated_at?: string;
}

export type ProveedorGrabacion = 'youtube' | 'drive';

export interface RecordedClass {
    id: string;
    curso_id: string;
    titulo: string;
    descripcion?: string | null;
    proveedor: ProveedorGrabacion;
    video_id: string;
    url_original: string;
    embed_url: string;
    thumbnail_url: string | null;
    oculto: boolean;
    activo: boolean;
    visto?: boolean;
    created_at: string;
    updated_at?: string;
}
export interface RecordedClassStats {
    total_vistas: number;
    total_cuentas: number;
}