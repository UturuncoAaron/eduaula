export interface Child {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string | null;
    codigo_estudiante: string;
    foto_storage_key?: string | null;
    grado: string | null;
    seccion: string | null;
}

export interface ChildGrade {
    id: string;
    bimestre: number;
    anio: number;
    periodo: string;
    curso: string;
    nota_tareas: number | null;
    nota_participacion: number | null;
    nota_final: number | null;
    escala: 'AD' | 'A' | 'B' | 'C' | string | null;
    observaciones: string | null;
}

export interface ChildAttendanceRecord {
    presente: boolean;
    justificacion: string | null;
    clase: string;
    fecha_hora: string;
    curso: string;
}

export interface ChildLibreta {
    id: string;
    cuenta_id: string;
    storage_key: string;
    nombre_archivo: string;
    observaciones: string | null;
    created_at: string;
    /** Signed URL provided by backend (libretas/hijo/:id). May be missing/null if storage failed. */
    url?: string | null;
    periodo: {
        id: number;
        bimestre: number;
        anio: number;
        nombre: string;
    } | null;
}

export type AnnouncementDestinatario = 'todos' | 'alumnos' | 'docentes' | 'padres';

export interface Announcement {
    id: string;
    titulo: string;
    contenido: string;
    destinatario: AnnouncementDestinatario;
    activo: boolean;
    created_at: string;
}
