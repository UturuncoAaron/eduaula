// Tipos compartidos para el módulo de asistencias.
// El backend (NestJS) acepta y devuelve estos shapes en /asistencias/*.

export const ESTADOS_ASISTENCIA = [
    'asistio',
    'falta',
    'tardanza',
    'justificado',
] as const;

export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

export const ESTADO_ASISTENCIA_LABEL: Record<EstadoAsistencia, string> = {
    asistio: 'Asistió',
    falta: 'Falta',
    tardanza: 'Tardanza',
    justificado: 'Justificado',
};

export const ESTADO_ASISTENCIA_ICON: Record<EstadoAsistencia, string> = {
    asistio: 'check_circle',
    falta: 'cancel',
    tardanza: 'schedule',
    justificado: 'event_available',
};

export const ESTADO_ASISTENCIA_COLOR: Record<EstadoAsistencia, string> = {
    asistio: '#2E7D32',
    falta: '#C62828',
    tardanza: '#ED6C02',
    justificado: '#1976D2',
};

// ─── Payloads que enviamos al backend ─────────────────────────────────────

export interface AsistenciaItemPayload {
    alumno_id: string;
    estado: EstadoAsistencia;
    observacion?: string | null;
}

export interface RegisterAsistenciaPayload extends AsistenciaItemPayload {
    /** YYYY-MM-DD */
    fecha: string;
    periodo_id?: string;
}

export interface BulkAsistenciaPayload {
    /** YYYY-MM-DD */
    fecha: string;
    periodo_id?: string;
    alumnos: AsistenciaItemPayload[];
}

export interface UpdateAsistenciaPayload {
    estado?: EstadoAsistencia;
    observacion?: string | null;
}

export interface ListAsistenciasQuery {
    fecha?: string;
    desde?: string;
    hasta?: string;
    limit?: number;
    offset?: number;
}

export interface ListAsistenciasCursoPorAlumnoQuery extends ListAsistenciasQuery {
    cursoId?: string;
}

export interface ReporteAsistenciaQuery {
    periodo_id: string;
    seccion_id?: string;
    curso_id?: string;
}

export interface ScanQrPayload {
    qr_token: string;
    /** Opcional. YYYY-MM-DD. Por defecto el backend usa la fecha del servidor. */
    fecha?: string;
}

// ─── Respuestas del backend ───────────────────────────────────────────────

export interface AsistenciaAlumnoResumen {
    id: string;
    codigo_estudiante: string | null;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    foto_url?: string | null;
}

export interface AsistenciaCursoRecord {
    id: string;
    alumno_id: string;
    curso_id: string;
    periodo_id: string;
    /** YYYY-MM-DD */
    fecha: string;
    estado: EstadoAsistencia;
    observacion: string | null;
    registrado_por: string | null;
    created_at: string;
    updated_at: string;
    alumno?: AsistenciaAlumnoResumen | null;
    curso?: { id: string; nombre: string } | null;
}

export interface AsistenciaGeneralRecord {
    id: string;
    alumno_id: string;
    seccion_id: string;
    periodo_id: string;
    fecha: string;
    estado: EstadoAsistencia;
    observacion: string | null;
    registrado_por: string | null;
    created_at: string;
    updated_at: string;
    alumno?: AsistenciaAlumnoResumen | null;
    seccion?: { id: string; nombre: string } | null;
}

/** Fila del reporte agregado por alumno. */
export interface ReporteAsistenciaRow {
    alumno_id: string;
    codigo_estudiante: string | null;
    apellido_paterno: string;
    apellido_materno: string | null;
    nombre: string;
    asistio: number;
    falta: number;
    tardanza: number;
    justificado: number;
    total_dias: number;
    pct_asistencia: number | null;
}

export interface ScanQrResponse {
    duplicate: boolean;
    attendance: AsistenciaGeneralRecord;
    alumno: AsistenciaAlumnoResumen;
}
