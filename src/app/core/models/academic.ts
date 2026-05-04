export interface GradeLevel {
    id: number;
    nombre: string;
    orden: number;
}

export interface Section {
    id: string;
    nombre: string;
    capacidad: number;
    grado_id: number;
    tutor_id: string | null;
    grado?: GradeLevel;
    tutor?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
    } | null;
}

export interface Period {
    id: number;
    nombre: string;
    anio: number;
    bimestre: number;
    fecha_inicio: string;
    fecha_fin: string;
    activo: boolean;
}

export interface Course {
    id: string;
    nombre: string;
    color: string | null;
    docente_id: string | null;
    seccion_id: string;
    periodo_id: number;
    activo: boolean;
    docente?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        especialidad?: string | null;
    };
    seccion?: {
        id: string;
        nombre: string;
        grado?: { id: number; nombre: string };
    };
}

export interface Matricula {
    id: string;
    activo: boolean;
    fecha_matricula: string;
    periodo_id: number;
    seccion_id: string;
    alumno_id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    codigo_estudiante: string | null;
    seccion_nombre: string;
    grado_id: number;
    grado_nombre: string;
    grado_orden: number;
}
export interface TutoriaResponse {
    seccion: {
        id: string;
        nombre: string;
        grado_id: number;
        grado_nombre: string;
        grado_orden: number;
        capacidad: number;
    };
    periodo_activo: Period | null;
    periodos: Period[];
    alumnos: {
        id: string;
        codigo_estudiante: string | null;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
        foto_url: string | null;
        libretas: {
            id: string;
            alumno_id: string;
            periodo_id: number;
            bimestre: number;
            storage_key: string;
            nombre_archivo: string;
            observaciones: string | null;
            created_at: string;
            url: string;
        }[];
    }[];
    padres: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
        relacion: string;
        email: string | null;
        telefono: string | null;
        hijos_ids: string[];
    }[];
}