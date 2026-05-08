

// ─────────────────────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────────────────────

export type ReportFormat = 'json' | 'xlsx';

export type EscalaCalificacion = 'AD' | 'A' | 'B' | 'C' | 'Sin notas';

export type EstadoAsistenciaAlumno =
    | 'asistio'
    | 'falta'
    | 'tardanza'
    | 'justificado'
    | 'sin-registro';

export type EstadoAsistenciaDocente =
    | 'presente'
    | 'tardanza'
    | 'ausente'
    | 'permiso'
    | 'licencia'
    | 'sin-registro';

export type CategoriaRendimiento = 'top' | 'normal' | 'riesgo' | 'sin-datos';

// ─────────────────────────────────────────────────────────────────────────────
// REPORTE MAESTRO DE SECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

export interface SeccionInfo {
    id: string;
    nombre: string;
    grado: string;
    grado_orden: number;
    tutor_nombre: string | null;
    tutor_id: string | null;
    capacidad: number;
    total_matriculados: number;
}

export interface PeriodoInfo {
    id: string;
    nombre: string;
    anio: number;
    bimestre: number;
    fecha_inicio: string;
    fecha_fin: string;
    activo: boolean;
}

export interface SeccionResumenResponse {
    seccion: SeccionInfo;
    periodo: PeriodoInfo;
    // Tab notas
    ranking: AlumnoRanking[];
    notas_por_curso: SeccionNotasRow[];
    // Tab asistencia
    resumen_asistencia: ResumenAsistenciaRow[];
    top_inasistentes: TopInasistenteRow[];
    // Tab tareas
    entregas_por_tarea: EntregasTareaRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTAS
// ─────────────────────────────────────────────────────────────────────────────

export interface AlumnoRanking {
    alumno_id: string;
    dni: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    nombre: string;
    promedio_general: string | null;
    cursos_en_riesgo: number;
    categoria: CategoriaRendimiento;
}

export interface SeccionNotasRow {
    alumno_id: string;
    dni: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    nombre: string;
    curso_id: string;
    curso: string;
    total_notas: number;
    promedio: string | null;
    escala: EscalaCalificacion;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASISTENCIA ALUMNOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ResumenAsistenciaRow {
    alumno_id: string;
    dni: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    nombre: string;
    dias_registrados: number;
    asistencias: number;
    tardanzas: number;
    faltas: number;
    justificadas: number;
    porcentaje_asistencia: string | null;
}

export interface TopInasistenteRow {
    alumno_id: string;
    dni: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    nombre: string;
    faltas: number;
    tardanzas: number;
    justificadas: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREAS
// ─────────────────────────────────────────────────────────────────────────────

export interface EntregasTareaRow {
    tarea_id: string;
    titulo: string;
    fecha_limite: string;
    bimestre: number | null;
    semana: number | null;
    total_alumnos: number;
    entregaron: number;
    pendientes: number;
    con_retraso: number;
    calificadas: number;
    promedio_calificacion: string | null;
    porcentaje_entrega: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASISTENCIA DOCENTES
// ─────────────────────────────────────────────────────────────────────────────

export interface HorarioDelDia {
    horario_id: string;
    curso_id: string;
    curso_nombre: string;
    seccion_nombre: string;
    grado_nombre: string;
    grado_orden: number;
    docente_id: string;
    docente_nombre: string;
    dia_semana: string;
    hora_inicio: string;
    hora_fin: string;
    aula: string | null;
    // Estado actual (si ya fue registrado hoy)
    asistencia_id: string | null;
    estado_actual: EstadoAsistenciaDocente;
    hora_llegada: string | null;
    tiene_justificacion: boolean;
    motivo_justificacion: string | null;
    hubo_reemplazo: boolean;
    observacion: string | null;
}

export interface RegistrarAsistenciaDocenteDto {
    horario_id: string;
    fecha: string;
    estado: EstadoAsistenciaDocente;
    hora_llegada?: string;
    tiene_justificacion?: boolean;
    motivo_justificacion?: string;
    hubo_reemplazo?: boolean;
    observacion?: string;
}

export interface RegistrarBulkDto {
    fecha: string;
    registros: RegistrarAsistenciaDocenteDto[];
}

export interface BulkResult {
    insertados: number;
    actualizados: number;
    errores: Array<{ horario_id: string; error: string }>;
}

export interface AsistenciaDocenteDiaria {
    asistencia_id: string | null;
    horario_id: string;
    docente_id: string;
    docente_nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    curso_nombre: string;
    seccion_nombre: string;
    grado_nombre: string;
    hora_inicio: string;
    hora_fin: string;
    aula: string | null;
    estado: EstadoAsistenciaDocente;
    hora_llegada: string | null;
    tiene_justificacion: boolean;
    motivo_justificacion: string | null;
    hubo_reemplazo: boolean;
    observacion: string | null;
}

export interface ResumenAsistenciaDocente {
    docente_id: string;
    docente_nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    total_bloques_esperados: number;
    presentes: number;
    tardanzas: number;
    ausentes: number;
    permisos: number;
    licencias: number;
    sin_registro: number;
    ausentes_sin_justificacion: number;
    porcentaje_asistencia: string | null;
}

export interface AlertaAusenciaDocente {
    docente_id: string;
    docente_nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    total_ausencias: number;
    sin_justificacion: number;
    clases_sin_cobertura: number;
    ultima_ausencia: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARÁMETROS DE FILTRO (para los componentes de UI)
// ─────────────────────────────────────────────────────────────────────────────

export interface FiltroSeccion {
    seccion_id: string;
    periodo_id: string;
    umbral?: number;
}

export interface FiltroRangoFechas {
    fecha_inicio: string;
    fecha_fin: string;
}