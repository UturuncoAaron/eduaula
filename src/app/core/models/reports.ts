import { Period } from './academic';

export type ReportFormat = 'json' | 'xlsx' | 'pdf' | 'csv';
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
    | 'falto'
    | 'justificado'
    | 'sin-registro';

export type CategoriaRendimiento = 'top' | 'normal' | 'riesgo' | 'sin-datos';

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

export interface PeriodoInfo extends Period { }

export interface SeccionResumenResponse {
    seccion: SeccionInfo;
    periodo: PeriodoInfo;
    ranking: AlumnoRanking[];
    notes_por_curso: SeccionNotasRow[];
    resumen_asistencia: ResumenAsistenciaRow[];
    top_inasistentes: TopInasistenteRow[];
    entregas_por_tarea: EntregasTareaRow[];
}

export interface AlumnoRanking {
    alumno_id: string;
    dni: string;
    alumno_nombre: string;
    promedio_general: string | null;
    cursos_en_riesgo: number;
    categoria: CategoriaRendimiento;
}

export interface SeccionNotasRow {
    alumno_id: string;
    dni: string;
    alumno_nombre: string;
    curso_id: string;
    curso: string;
    total_notes: number;
    promedio: string | null;
    escala: EscalaCalificacion;
}

export interface ResumenAsistenciaRow {
    alumno_id: string;
    dni: string;
    alumno_nombre: string;
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
    alumno_nombre: string;
    faltas: number;
    tardanzas: number;
    justificadas: number;
}

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
    faltos: number;
    justificados: number;
    sin_registro: number;
    faltos_sin_justificacion: number;
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

export interface FiltroSeccion {
    seccion_id: string;
    periodo_id: string;
    umbral?: number;
}

export interface FiltroRangoFechas {
    fecha_inicio: string;
    fecha_fin: string;
}

export interface ResumenAsistenciaStaff {
    staff_id: string;
    cargo: string;
    staff_nombre: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    total_esperados: number;
    presentes: number;
    tardanzas: number;
    faltos: number;
    justificados: number;
    porcentaje_asistencia: string | null;
}