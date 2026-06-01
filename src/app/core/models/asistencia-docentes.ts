// ─── Estados ───────────────────────────────────────────────────────────────

export const ESTADOS_ASISTENCIA_DOCENTE = [
    'presente',
    'tardanza',
    'falto',
    'justificado',
] as const;

export type EstadoDocenteAsistencia = (typeof ESTADOS_ASISTENCIA_DOCENTE)[number];

export const ESTADO_DOCENTE_LABEL: Record<EstadoDocenteAsistencia, string> = {
    presente: 'Presente',
    tardanza: 'Tardanza',
    falto: 'Faltó',
    justificado: 'Justificado',
};

export const ESTADO_DOCENTE_COLOR: Record<EstadoDocenteAsistencia, string> = {
    presente: '#10b981',
    tardanza: '#f59e0b',
    falto: '#ef4444',
    justificado: '#3b82f6',
};

export const ESTADO_DOCENTE_ICON: Record<EstadoDocenteAsistencia, string> = {
    presente: 'check_circle',
    tardanza: 'schedule',
    falto: 'person_off',
    justificado: 'assignment_ind',
};

// ─── Respuestas del backend ────────────────────────────────────────────────

export interface BloqueDocenteInfo {
    horario_id: string;
    hora_inicio: string;
    hora_fin: string;
    curso_nombre: string;
    seccion_nombre: string;
    aula: string | null;
    estado_bloque: string | null;
    hora_salida: string | null;
}

export interface DocenteDelDia {
    docente_id: string;
    docente_nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    primera_clase: string;
    ultima_clase: string;
    total_bloques: number;
    estado_actual: EstadoDocenteAsistencia | null;
    hora_llegada: string | null;
    hora_salida: string | null;
    motivo: string | null;
    ya_registrado: boolean;
    bloques_json: BloqueDocenteInfo[];
}

export interface ReporteDocenteRow {
    docente_nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    curso_nombre: string;
    seccion_nombre: string;
    grado_nombre: string;
    hora_inicio: string;
    hora_fin: string;
    aula: string | null;
    estado: string;
    hora_llegada: string | null;
    hora_salida: string | null;
    motivo_justificacion: string | null;
    hubo_reemplazo: boolean;
}

export interface ResumenDocenteRow {
    docente_id: string;
    docente_nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    total_bloques_esperados: number;
    presentes: number;
    tardanzas: number;
    faltos: number;
    justificados: number;
    sin_registro: number;
    porcentaje_asistencia: number | null;
}

// ─── Payloads al backend ───────────────────────────────────────────────────

export interface RegistroDocentePayload {
    docente_id: string;
    estado: EstadoDocenteAsistencia;
    hora_llegada?: string;
    motivo_justificacion?: string;
    hubo_reemplazo?: boolean;
    observacion?: string;
}

export interface BulkRegistroDocentePayload {
    fecha: string;
    docentes: RegistroDocentePayload[];
}

export interface MarcarSalidaPayload {
    horario_id: string;
    fecha: string;
    hora_salida: string;
}

// ─── Filtros de reporte ────────────────────────────────────────────────────

export type TipoFiltroReporte = 'dia' | 'rango' | 'bimestre' | 'anio';

export interface ReporteDocenteFilters {
    tipo: TipoFiltroReporte;
    fecha?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
}