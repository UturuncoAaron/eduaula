// Modelos del módulo académico
// Centralizar aquí evita duplicar interfaces en cada componente

export interface GradeLevel {
    id: number;
    nombre: string;
    orden: number;
}

export interface Section {
    id: number;
    nombre: string;
    capacidad: number;
    grado_id: number;
    tutor_id: string | null;
    grado?: GradeLevel;

    // Datos del docente que ejerce la tutoría (LEFT JOIN desde el backend).
    // Es null si la sección no tiene tutor asignado.
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
    seccion_id: number;
    periodo_id: number;
    activo: boolean;
    docente?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        especialidad?: string | null;
    };
    seccion?: {
        id: number;
        nombre: string;
        grado?: { id: number; nombre: string };
    };
}