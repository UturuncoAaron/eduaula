export interface Periodo {
    id: number;
    nombre: string;
    bimestre: number;
    anio: number;
    activo: boolean;
}

export interface NotebookItem {
    id: string;
    alumno_id?: string; 
    periodo_id: number;
    bimestre: number;
    storage_key: string;
    url: string;
    nombre_archivo: string | null;
    observaciones: string | null;
    created_at: string;
}

export interface AlumnoTutoria {
    id: string;
    codigo_estudiante: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    foto_url: string | null;
    inclusivo?: boolean;
    libretas: NotebookItem[];
}

export interface PadreTutoria {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    relacion: string;
    email: string | null;
    telefono: string | null;
    hijos_ids: string[];
    libretas: NotebookItem[];
}

export interface TutoriaData {
    seccion: {
        id: string;
        nombre: string;
        grado_id: string;
        grado_nombre: string;
        grado_orden: number;
        capacidad: number;
    };
    periodo_activo: Periodo | null;
    periodos: Periodo[];
    alumnos: AlumnoTutoria[];
    padres: PadreTutoria[];
}