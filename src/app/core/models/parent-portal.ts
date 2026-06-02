export interface Child {
    id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string | null;
    codigo_estudiante: string;
    foto_storage_key?: string | null;
    grado: string | null;
    seccion: string | null;
    anio_matricula?: number | null;
}

// ─── Notas ────────────────────────────────────────────────────────────────────

/** Una evaluación individual dentro de un curso/bimestre. */
export interface NotaItem {
    nota_id: string;
    titulo: string;
    tipo: string;
    nota: number | null;
    observaciones: string | null;
    fecha: string | null;
}

/** Grupo de notas de un curso en un bimestre. Estructura que devuelve el backend. */
export interface CursoGradesGroup {
    curso_id: string;
    curso_nombre: string;
    area: string | null;
    color: string;
    periodo_id: string;
    periodo_nombre: string;
    bimestre: number;
    anio: number;
    notas: NotaItem[];
    promedio: number | null;
}

// ─── Asistencia ───────────────────────────────────────────────────────────────

export interface AttendanceGeneralResumen {
    total: number;
    asistio: number;
    tardanza: number;
    justificado: number;
    falta: number;
    porcentaje: number | null;
}

export interface AttendanceGeneralDetalle {
    id: string;
    fecha: string;
    estado: 'asistio' | 'tardanza' | 'justificado' | 'falta';
    observacion: string | null;
    periodo_nombre: string;
    periodo_anio: number;
    periodo_bimestre: number;
}

export interface AttendanceGeneralPayload {
    resumen: AttendanceGeneralResumen;
    detalle: AttendanceGeneralDetalle[];
}

// ─── Horario ─────────────────────────────────────────────────────────────────

export interface ScheduleSlot {
    diaSemana: string;
    horaInicio: string;
    horaFin: string;
    curso: string;
    aula: string | null;
    docente: string | null;
}

// ─── Libretas ─────────────────────────────────────────────────────────────────

export interface ChildLibreta {
    id: string;
    cuenta_id: string;
    storage_key: string;
    nombre_archivo: string;
    observaciones: string | null;
    created_at: string;
    url?: string | null;
    periodo: {
        id: number;
        bimestre: number;
        anio: number;
        nombre: string;
    } | null;
}

// ─── Comunicados ──────────────────────────────────────────────────────────────

export type AnnouncementDestinatario = 'todos' | 'alumnos' | 'docentes' | 'padres';

export interface Announcement {
    id: string;
    titulo: string;
    contenido: string;
    destinatario: AnnouncementDestinatario;
    activo: boolean;
    created_at: string;
}

// ─── Legacy (mantener hasta eliminar referencias) ────────────────────────────

/** @deprecated Usar CursoGradesGroup + NotaItem */
export interface ChildGrade {
    id: string;
    bimestre: number;
    anio: number;
    periodo: string;
    curso: string;
    titulo: string;
    tipo: string;
    nota: number | null;
    observaciones: string | null;
    fecha: string | null;
}

/** @deprecated Endpoint eliminado en v7 */
export interface ChildAttendanceRecord {
    presente: boolean;
    justificacion: string | null;
    clase: string;
    fecha_hora: string;
    curso: string;
}